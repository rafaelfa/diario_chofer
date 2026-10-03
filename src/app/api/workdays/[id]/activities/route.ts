import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { calcKmTraveled, calcWorkDayHours, getTimeAtUtcOffset } from '@/lib/time';
import { logError } from '@/lib/logger';
import type { WorkActivityType } from '@/lib/types';

const ACTIVITY_TYPES = new Set<WorkActivityType>(['loading', 'unloading', 'refueling', 'other']);
const OFFSET_PATTERN = /^[+-](?:0\d|1[0-4]):[0-5]\d$/;

class ActivityRequestError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await requireAuth();
    const { id: workDayId } = await params;
    const body = await request.json();
    const { action, type, currentAt, utcOffset } = body;

    if (action !== 'start' && action !== 'finish') {
      return NextResponse.json({ error: 'Ação inválida' }, { status: 400 });
    }
    if (action === 'start' && (typeof type !== 'string' || !ACTIVITY_TYPES.has(type as WorkActivityType))) {
      return NextResponse.json({ error: 'Tipo de atividade inválido' }, { status: 400 });
    }
    if (typeof currentAt !== 'string' || Number.isNaN(new Date(currentAt).getTime())) {
      return NextResponse.json({ error: 'Horário da atividade inválido' }, { status: 400 });
    }
    if (typeof utcOffset !== 'string' || !OFFSET_PATTERN.test(utcOffset)) {
      return NextResponse.json({ error: 'Fuso horário inválido' }, { status: 400 });
    }

    const currentAtDate = new Date(currentAt);
    const currentTime = getTimeAtUtcOffset(currentAtDate, utcOffset);

    const updatedDay = await db.$transaction(async transaction => {
      const workDay = await transaction.workDay.findFirst({
        where: { id: workDayId, userId },
        include: {
          drivingSessions: { orderBy: { createdAt: 'asc' } },
          workActivities: { orderBy: { startedAt: 'asc' } },
          breakPeriods: { orderBy: { startedAt: 'asc' } },
        },
      });

      if (!workDay) throw new ActivityRequestError('Dia de trabalho não encontrado', 404);
      if (workDay.endTime) throw new ActivityRequestError('A jornada já foi finalizada', 409);

      const activeActivity = workDay.workActivities.find(activity => !activity.endedAt);
      const activeSession = workDay.drivingSessions.find(session => session.status === 'active' && !session.endTime);

      if (action === 'start') {
        if (workDay.breakStart && workDay.breakType) {
          throw new ActivityRequestError('Finalize a pausa legal antes de iniciar outra atividade', 409);
        }
        if (activeActivity) throw new ActivityRequestError('Já existe uma atividade sem condução em andamento', 409);

        if (activeSession) {
          const changedSession = await transaction.drivingSession.updateMany({
            where: { id: activeSession.id, workDayId, userId, status: 'active', endTime: null },
            data: { endTime: currentTime, endKm: null, status: 'paused' },
          });
          if (changedSession.count !== 1) throw new ActivityRequestError('A sessão mudou. Atualize os dados.', 409);
        } else if (workDay.drivingSessions.length > 0) {
          // Sem sessão ativa só é válido quando a jornada arrancou em modo serviço
          // (nenhuma condução registada até agora).
          throw new ActivityRequestError('Não há sessão de condução ativa para interromper', 409);
        }

        await transaction.workActivity.create({
          data: {
            workDayId,
            userId,
            driverNumber: activeSession?.driverNumber ?? workDay.primaryDriverNumber ?? 1,
            type: type as WorkActivityType,
            startedAt: currentAtDate,
            startKm: null,
          },
        });
      } else {
        if (activeSession) throw new ActivityRequestError('Uma sessão de condução já está ativa', 409);
        if (!activeActivity) throw new ActivityRequestError('Não há atividade sem condução em andamento', 409);

        const changedActivity = await transaction.workActivity.updateMany({
          where: { id: activeActivity.id, workDayId, userId, endedAt: null },
          data: { endedAt: currentAtDate, endKm: null },
        });
        if (changedActivity.count !== 1) throw new ActivityRequestError('A atividade mudou. Atualize os dados.', 409);

        await transaction.drivingSession.create({
          data: {
            workDayId,
            userId,
            driverNumber: activeActivity.driverNumber,
            startTime: currentTime,
            startKm: null,
            status: 'active',
            utcOffset,
          },
        });
      }

      return transaction.workDay.findFirstOrThrow({
        where: { id: workDayId, userId },
        include: {
          events: { orderBy: { time: 'asc' } },
          drivingSessions: { orderBy: { createdAt: 'asc' } },
          workActivities: { orderBy: { startedAt: 'asc' } },
          breakPeriods: { orderBy: { startedAt: 'asc' } },
        },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    const activeWorkActivity = updatedDay.workActivities.find(activity => !activity.endedAt) ?? null;
    const lastSession = updatedDay.drivingSessions.at(-1);

    return NextResponse.json({
      ...updatedDay,
      activeWorkActivity,
      lastSessionKm: lastSession?.endKm ?? lastSession?.startKm ?? null,
      kmTraveled: calcKmTraveled(updatedDay.drivingSessions, updatedDay.startKm, updatedDay.endKm),
      hoursWorked: calcWorkDayHours(updatedDay),
      totalEvents: updatedDay.events.length,
      sessionCount: updatedDay.drivingSessions.length,
    });
  } catch (error) {
    if (error instanceof ActivityRequestError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
      return NextResponse.json({ error: 'A atividade mudou em outra solicitação. Atualize e tente novamente.' }, { status: 409 });
    }
    if (error instanceof Error && error.message.startsWith('UNAUTHORIZED')) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    logError('Error managing non-driving activity:', error);
    return NextResponse.json({ error: 'Erro ao gerenciar atividade' }, { status: 500 });
  }
}
