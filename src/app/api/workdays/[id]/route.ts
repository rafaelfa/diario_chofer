import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { calcHoursWorked, calcKmTraveled } from '@/lib/time';
import { log, logError } from '@/lib/logger';

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
          orderBy: { startTime: 'asc' }
        }
      }
    });

    if (!workDay) {
      return NextResponse.json({ error: 'Dia não encontrado' }, { status: 404 });
    }

    // Calcular KM total — centralizado em calcKmTraveled
    const kmTraveled = calcKmTraveled(workDay.drivingSessions || [], workDay.startKm, workDay.endKm);

    // Calcular horas trabalhadas — centralizado em calcHoursWorked
    const hoursWorked = calcHoursWorked(workDay.drivingSessions || [], workDay.startTime, workDay.endTime);

    // Calcular último KM da sessão
    let lastSessionKm: number | null = null;
    if (workDay.drivingSessions && workDay.drivingSessions.length > 0) {
      const lastSession = workDay.drivingSessions[workDay.drivingSessions.length - 1];
      lastSessionKm = lastSession.endKm || lastSession.startKm;
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
      where: { id, userId }
    });

    if (!existingWorkDay) {
      return NextResponse.json({ error: 'Dia não encontrado' }, { status: 404 });
    }

    // Só atualiza os campos que foram enviados no body
    const dataToUpdate: Record<string, unknown> = {};

    if (body.date !== undefined) {
      const parsedDate = new Date(body.date);
      if (isNaN(parsedDate.getTime())) {
        return NextResponse.json({ error: 'Data inválida' }, { status: 400 });
      }
      dataToUpdate.date = parsedDate;
    }
    if (body.startTime !== undefined) dataToUpdate.startTime = body.startTime;
    if (body.endTime !== undefined) dataToUpdate.endTime = body.endTime || null;
    if (body.startCountry !== undefined) dataToUpdate.startCountry = body.startCountry || null;
    if (body.endCountry !== undefined) dataToUpdate.endCountry = body.endCountry || null;
    if (body.startKm !== undefined) dataToUpdate.startKm = body.startKm ? parseInt(body.startKm) : null;
    if (body.endKm !== undefined) dataToUpdate.endKm = body.endKm ? parseInt(body.endKm) : null;
    if (body.lastRest !== undefined) dataToUpdate.lastRest = body.lastRest || null;
    if (body.amplitude !== undefined) dataToUpdate.amplitude = body.amplitude || null;
    if (body.truckCheck !== undefined) dataToUpdate.truckCheck = Boolean(body.truckCheck);
    if (body.observations !== undefined) dataToUpdate.observations = body.observations || null;
    if (body.matricula !== undefined) dataToUpdate.matricula = body.matricula ? body.matricula.toUpperCase() : null;

    log('Dados a atualizar:', JSON.stringify(dataToUpdate, null, 2));

    // Se está finalizando o dia (tem endTime), atualizar também a sessão ativa
    if (body.endTime && body.endKm) {
      const endTime = body.endTime;
      const endKm = parseInt(body.endKm);

      // Buscar sessão ativa (sem endTime) DO USUÁRIO
      const activeSession = await db.drivingSession.findFirst({
        where: {
          workDayId: id,
          userId,  // ✅ ISOLAMENTO
          endTime: null
        }
      });

      if (activeSession) {
        log(`Atualizando sessão ativa ${activeSession.id} com endTime=${endTime}, endKm=${endKm}`);
        await db.drivingSession.update({
          where: { id: activeSession.id },
          data: {
            endTime: endTime,
            endKm: endKm,
            status: 'ended'
          }
        });
      }
    }

    const workDay = await db.workDay.update({
      where: { id },
      data: dataToUpdate,
      include: {
        events: true,
        drivingSessions: {
          orderBy: { startTime: 'asc' }
        }
      }
    });

    // Calcular lastSessionKm (campo calculado, não existe no schema Prisma)
    const allSessions = workDay.drivingSessions || [];
    const lastSession = allSessions[allSessions.length - 1];
    const lastSessionKm = lastSession?.endKm ?? lastSession?.startKm ?? null;

    log('Registro atualizado:', JSON.stringify(workDay, null, 2));

    return NextResponse.json({ ...workDay, lastSessionKm });
  } catch (error) {
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
