import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { requireAuth } from '@/lib/auth';
import { calcKmTraveled, calcWorkDayHours } from '@/lib/time';
import { log, logError } from '@/lib/logger';
import { isValidTimeString, parseNonNegativeInteger, validateMatricula } from '@/lib/validators';

// GET - Buscar dia de trabalho por ID (apenas se pertencer ao usuário)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // ✅ ISOLAMENTO: Verificar autenticação
    const { userId } = await requireAuth();
    const { id } = await params;

    // ✅ ISOLAMENTO: Buscar apenas se pertencer ao usuário
    const workDay = await db.workDay.findFirst({
      where: {
        id,
        userId  // ← OBRIGATÓRIO: isolamento por usuário
      },
      include: {
        events: {
          orderBy: { time: 'asc' }
        },
        drivingSessions: {
          orderBy: { createdAt: 'asc' }
        }
      }
    });

    if (!workDay) {
      return NextResponse.json({ error: 'Dia não encontrado' }, { status: 404 });
    }

    // Calcular KM total — centralizado em calcKmTraveled
    const kmTraveled = calcKmTraveled(workDay.drivingSessions || [], workDay.startKm, workDay.endKm);

    // Calcular horas trabalhadas — centralizado em calcHoursWorked
    const hoursWorked = calcWorkDayHours(workDay);

    // Calcular último KM da sessão
    let lastSessionKm: number | null = null;
    if (workDay.drivingSessions && workDay.drivingSessions.length > 0) {
      const lastSession = workDay.drivingSessions[workDay.drivingSessions.length - 1];
      lastSessionKm = lastSession.endKm ?? lastSession.startKm;
    }

    // Contar sessões de condução
    const sessionCount = workDay.drivingSessions?.length || 0;

    return NextResponse.json({
      ...workDay,
      kmTraveled,
      hoursWorked,
      totalEvents: workDay.events.length,
      lastSessionKm,
      sessionCount
    });
  } catch (error) {
    // Tratar erro de autenticação
    if (error instanceof Error && error.message.startsWith('UNAUTHORIZED')) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    logError('Error fetching work day:', error);
    return NextResponse.json({ error: 'Erro ao buscar dia de trabalho' }, { status: 500 });
  }
}

// PUT - Atualizar dia de trabalho (apenas se pertencer ao usuário)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // ✅ ISOLAMENTO: Verificar autenticação
    const { userId } = await requireAuth();
    const { id } = await params;
    const body = await request.json();

    log('PUT recebido:', JSON.stringify(body, null, 2));

    // ✅ ISOLAMENTO: Verificar se o registro pertence ao usuário
    const existingWorkDay = await db.workDay.findFirst({
      where: { id, userId },
      include: { drivingSessions: { orderBy: { createdAt: 'asc' } } },
    });

    if (!existingWorkDay) {
      return NextResponse.json({ error: 'Dia não encontrado' }, { status: 404 });
    }

    // Só atualiza os campos que foram enviados no body
    const dataToUpdate: Record<string, unknown> = {};

    if (body.date !== undefined) {
      if (typeof body.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
        return NextResponse.json({ error: 'Data inválida' }, { status: 400 });
      }
      const parsedDate = new Date(`${body.date}T00:00:00.000Z`);
      if (Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== body.date) {
        return NextResponse.json({ error: 'Data inválida' }, { status: 400 });
      }
      dataToUpdate.date = parsedDate;
    }
    if (body.startTime !== undefined) {
      if (!isValidTimeString(body.startTime)) return NextResponse.json({ error: 'Hora inicial inválida' }, { status: 400 });
      dataToUpdate.startTime = body.startTime;
    }
    if (body.endTime !== undefined && body.endTime !== null && body.endTime !== '' && !isValidTimeString(body.endTime)) {
      return NextResponse.json({ error: 'Hora final inválida' }, { status: 400 });
    }
    if (body.endTime !== undefined) dataToUpdate.endTime = body.endTime || null;
    if (body.startCountry !== undefined) {
      if (body.startCountry !== null && typeof body.startCountry !== 'string') return NextResponse.json({ error: 'País inicial inválido' }, { status: 400 });
      dataToUpdate.startCountry = body.startCountry?.trim() || null;
    }
    if (body.endCountry !== undefined) {
      if (body.endCountry !== null && typeof body.endCountry !== 'string') return NextResponse.json({ error: 'País final inválido' }, { status: 400 });
      dataToUpdate.endCountry = body.endCountry?.trim() || null;
    }
    const parsedStartKm = body.startKm === undefined ? null : parseNonNegativeInteger(body.startKm);
    const parsedEndKm = body.endKm === undefined ? null : parseNonNegativeInteger(body.endKm);
    if (parsedStartKm && !parsedStartKm.valid || parsedEndKm && !parsedEndKm.valid) {
      return NextResponse.json({ error: 'KM deve ser um inteiro não negativo' }, { status: 400 });
    }
    if (body.startKm !== undefined) dataToUpdate.startKm = parsedStartKm?.value ?? null;
    if (body.endKm !== undefined) dataToUpdate.endKm = parsedEndKm?.value ?? null;
    const startKm = body.startKm !== undefined ? parsedStartKm?.value : existingWorkDay.startKm;
    const endKm = body.endKm !== undefined ? parsedEndKm?.value : existingWorkDay.endKm;
    if (startKm != null && endKm != null && endKm < startKm) {
      return NextResponse.json({ error: 'KM final não pode ser menor que o KM inicial' }, { status: 400 });
    }
    if (body.lastRest !== undefined) dataToUpdate.lastRest = body.lastRest || null;
    if (body.amplitude !== undefined) dataToUpdate.amplitude = body.amplitude || null;
    if (body.truckCheck !== undefined) dataToUpdate.truckCheck = Boolean(body.truckCheck);
    if (body.observations !== undefined) dataToUpdate.observations = body.observations || null;
    if (body.matricula !== undefined) {
      if (body.matricula && typeof body.matricula !== 'string') return NextResponse.json({ error: 'Matrícula inválida' }, { status: 400 });
      if (body.matricula) {
        const { valid, normalized } = validateMatricula(body.matricula);
        if (!valid) return NextResponse.json({ error: 'Formato de matrícula inválido' }, { status: 400 });
        dataToUpdate.matricula = normalized;
      } else {
        dataToUpdate.matricula = null;
      }
    }
    if (body.breakStart !== undefined) {
      const parsedBreakStart = body.breakStart ? new Date(body.breakStart) : null;
      if (parsedBreakStart && Number.isNaN(parsedBreakStart.getTime())) return NextResponse.json({ error: 'Início da pausa inválido' }, { status: 400 });
      dataToUpdate.breakStart = parsedBreakStart;
    }
    if (body.breakType !== undefined) {
      if (body.breakType !== null && body.breakType !== '' && !['continuous', 'split'].includes(body.breakType)) {
        return NextResponse.json({ error: 'Tipo de pausa inválido' }, { status: 400 });
      }
      dataToUpdate.breakType = body.breakType || null;
    }
    if (body.breakMinutes !== undefined) {
      const parsedBreakMinutes = parseNonNegativeInteger(body.breakMinutes);
      if (!parsedBreakMinutes.valid) return NextResponse.json({ error: 'Minutos de pausa inválidos' }, { status: 400 });
      dataToUpdate.breakMinutes = parsedBreakMinutes.value ?? 0;
    }

    log('Dados a atualizar:', JSON.stringify(dataToUpdate, null, 2));

    const workDay = await db.$transaction(async transaction => {
      const sessions = existingWorkDay.drivingSessions;
      const firstSession = sessions[0];
      const lastSession = sessions[sessions.length - 1];

      if (firstSession && (body.startTime !== undefined || body.startKm !== undefined)) {
        await transaction.drivingSession.update({
          where: { id: firstSession.id },
          data: {
            ...(body.startTime !== undefined ? { startTime: body.startTime } : {}),
            ...(body.startKm !== undefined ? { startKm: parsedStartKm?.value ?? null } : {}),
          },
        });
      }

      if (lastSession && (body.endTime !== undefined || body.endKm !== undefined)) {
        await transaction.drivingSession.update({
          where: { id: lastSession.id },
          data: {
            ...(body.endTime !== undefined ? { endTime: body.endTime || null, status: body.endTime ? 'ended' : 'active' } : {}),
            ...(body.endKm !== undefined ? { endKm: parsedEndKm?.value ?? null } : {}),
          },
        });
      }

      return transaction.workDay.update({
        where: { id },
        data: dataToUpdate,
        include: { events: true, drivingSessions: { orderBy: { createdAt: 'asc' } } },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    // Calcular lastSessionKm (campo calculado, não existe no schema Prisma)
    const allSessions = workDay.drivingSessions || [];
    const lastSession = allSessions[allSessions.length - 1];
    const lastSessionKm = lastSession?.endKm ?? lastSession?.startKm ?? null;

    log('Registro atualizado:', JSON.stringify(workDay, null, 2));

    return NextResponse.json({ ...workDay, lastSessionKm });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
      return NextResponse.json({ error: 'A jornada foi alterada simultaneamente. Atualize e tente novamente.' }, { status: 409 });
    }
    // Tratar erro de autenticação
    if (error instanceof Error && error.message.startsWith('UNAUTHORIZED')) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    logError('Error updating work day:', error);
    return NextResponse.json({ error: 'Erro ao atualizar dia de trabalho' }, { status: 500 });
  }
}

// DELETE - Deletar dia de trabalho (apenas se pertencer ao usuário)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // ✅ ISOLAMENTO: Verificar autenticação
    const { userId } = await requireAuth();
    const { id } = await params;

    // ✅ ISOLAMENTO: Verificar se o registro pertence ao usuário
    const existingWorkDay = await db.workDay.findFirst({
      where: { id, userId }
    });

    if (!existingWorkDay) {
      return NextResponse.json({ error: 'Dia não encontrado' }, { status: 404 });
    }

    await db.workDay.delete({
      where: { id }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    // Tratar erro de autenticação
    if (error instanceof Error && error.message.startsWith('UNAUTHORIZED')) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    logError('Error deleting work day:', error);
    return NextResponse.json({ error: 'Erro ao deletar dia de trabalho' }, { status: 500 });
  }
}
