import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { requireAuth, isCsrfSafe} from '@/lib/auth';
import { calcKmTraveled } from '@/lib/time';
import { logError } from '@/lib/logger';
import { isValidTimeString, parseNonNegativeInteger } from '@/lib/validators';

// GET - Buscar sessões de um dia de trabalho DO USUÁRIO LOGADO
export async function GET(request: NextRequest) {
  try {
    // ✅ ISOLAMENTO: Verificar autenticação
    const { userId } = await requireAuth();

    const { searchParams } = new URL(request.url);
    const workDayId = searchParams.get('workDayId');

    if (!workDayId) {
      return NextResponse.json({ error: 'workDayId é obrigatório' }, { status: 400 });
    }

    // ✅ ISOLAMENTO: Verificar se o workDay pertence ao usuário
    const workDay = await db.workDay.findFirst({
      where: { id: workDayId, userId }
    });

    if (!workDay) {
      return NextResponse.json({ error: 'Dia de trabalho não encontrado' }, { status: 404 });
    }

    const sessions = await db.drivingSession.findMany({
      where: { workDayId, userId },
      orderBy: { createdAt: 'asc' }
    });

    const totalKm = calcKmTraveled(sessions, workDay.startKm, workDay.endKm);

    // Pegar último KM registrado
    const lastSession = sessions[sessions.length - 1];
    const lastKm = lastSession?.endKm ?? lastSession?.startKm ?? null;

    return NextResponse.json({
      sessions,
      totalKm,
      lastKm,
      activeSession: sessions.find(s => s.status === 'active' && !s.endTime)
    });
  } catch (error) {
    // Tratar erro de autenticação
    if (error instanceof Error && error.message.startsWith('UNAUTHORIZED')) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    logError('Error fetching driving sessions:', error);
    return NextResponse.json({ error: 'Erro ao buscar sessões' }, { status: 500 });
  }
}

// POST - Pausar sessão atual ou criar nova sessão (retomar) DO USUÁRIO LOGADO
export async function POST(request: NextRequest) {
  try {
    if (!isCsrfSafe(request)) {
      return NextResponse.json({ error: 'Requisição bloqueada (origem inválida)' }, { status: 403 });
    }

    // ✅ ISOLAMENTO: Verificar autenticação
    const { userId } = await requireAuth();

    const body = await request.json();
    const { workDayId, action, currentKm, currentTime: clientTime, utcOffset: clientOffset } = body;

    if (typeof workDayId !== 'string' || !['pause', 'resume'].includes(action)) {
      return NextResponse.json({ error: 'workDayId e action são obrigatórios' }, { status: 400 });
    }

    if (!isValidTimeString(clientTime)) {
      return NextResponse.json({ error: 'currentTime deve estar no formato HH:MM' }, { status: 400 });
    }
    if (clientOffset !== null && clientOffset !== undefined && !/^[+-](?:0\d|1[0-4]):[0-5]\d$/.test(clientOffset)) {
      return NextResponse.json({ error: 'utcOffset inválido' }, { status: 400 });
    }
    const parsedKm = parseNonNegativeInteger(currentKm);
    if (!parsedKm.valid || parsedKm.value === null) {
      return NextResponse.json({ error: 'KM atual deve ser um inteiro não negativo' }, { status: 400 });
    }

    const workDay = await db.workDay.findFirst({
      where: { id: workDayId, userId },
      include: {
        drivingSessions: { orderBy: { createdAt: 'asc' } }
      }
    });

    if (!workDay) {
      return NextResponse.json({ error: 'Dia de trabalho não encontrado' }, { status: 404 });
    }

    if (workDay.endTime) {
      return NextResponse.json({ error: 'Não é possível alterar sessões de uma jornada finalizada' }, { status: 409 });
    }

    const currentTime = clientTime;
    const sessionOffset = clientOffset || null;

    if (action === 'pause') {
      if (workDay.isPaused) return NextResponse.json({ error: 'A jornada já está pausada' }, { status: 409 });
      const activeSession = workDay.drivingSessions.find(session => session.status === 'active' && !session.endTime);
      if (!activeSession) return NextResponse.json({ error: 'Nenhuma sessão ativa para pausar' }, { status: 409 });
      if (activeSession.startKm != null && parsedKm.value < activeSession.startKm) {
        return NextResponse.json({ error: 'KM atual não pode ser menor que o KM inicial da sessão' }, { status: 400 });
      }

      const updatedWorkDay = await db.$transaction(async transaction => {
        const changedSession = await transaction.drivingSession.updateMany({
          where: { id: activeSession.id, userId, workDayId, status: 'active', endTime: null },
          data: { endTime: currentTime, endKm: parsedKm.value, status: 'paused' },
        });
        const changedDay = await transaction.workDay.updateMany({
          where: { id: workDayId, userId, isPaused: false, endTime: null },
          data: { isPaused: true },
        });
        if (changedSession.count !== 1 || changedDay.count !== 1) throw new Error('SESSION_CONFLICT');
        return transaction.workDay.findFirstOrThrow({
          where: { id: workDayId, userId },
          include: { events: true, drivingSessions: { orderBy: { createdAt: 'asc' } } },
        });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

      // Calcular lastSessionKm (campo calculado, não existe no schema Prisma)
      const allSessions = updatedWorkDay.drivingSessions;
      const lastSession = allSessions[allSessions.length - 1];
      const lastSessionKm = lastSession?.endKm ?? lastSession?.startKm ?? null;

      return NextResponse.json({
        ...updatedWorkDay,
        lastSessionKm,
        message: 'Condução pausada com sucesso'
      });
    }

    if (action === 'resume') {
      if (!workDay.isPaused) return NextResponse.json({ error: 'A jornada não está pausada' }, { status: 409 });
      if (workDay.drivingSessions.some(session => session.status === 'active' && !session.endTime)) {
        return NextResponse.json({ error: 'Já existe uma sessão ativa' }, { status: 409 });
      }
      const prevLastSession = workDay.drivingSessions[workDay.drivingSessions.length - 1];
      const previousKm = prevLastSession?.endKm ?? workDay.startKm;
      const driverNumber = workDay.numDrivers === 2
        ? (prevLastSession?.driverNumber === workDay.primaryDriverNumber
          ? (workDay.primaryDriverNumber === 1 ? 2 : 1)
          : workDay.primaryDriverNumber)
        : 1;
      if (previousKm != null && parsedKm.value < previousKm) {
        return NextResponse.json({ error: 'KM atual não pode ser menor que o último KM registrado' }, { status: 400 });
      }

      const updatedWorkDay = await db.$transaction(async transaction => {
        const changedDay = await transaction.workDay.updateMany({
          where: { id: workDayId, userId, isPaused: true, endTime: null },
          data: { isPaused: false },
        });
        if (changedDay.count !== 1) throw new Error('SESSION_CONFLICT');
        await transaction.drivingSession.create({
          data: {
            workDayId,
            userId,
            startTime: currentTime,
            startKm: parsedKm.value,
            status: 'active',
            driverNumber,
            utcOffset: sessionOffset,
          },
        });
        return transaction.workDay.findFirstOrThrow({
          where: { id: workDayId, userId },
          include: { events: true, drivingSessions: { orderBy: { createdAt: 'asc' } } },
        });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

      // Calcular lastSessionKm (campo calculado, não existe no schema Prisma)
      const resumeSessions = updatedWorkDay.drivingSessions;
      const resumeLastSession = resumeSessions[resumeSessions.length - 1];
      const resumeLastSessionKm = resumeLastSession?.endKm ?? resumeLastSession?.startKm ?? null;

      return NextResponse.json({
        ...updatedWorkDay,
        lastSessionKm: resumeLastSessionKm,
        message: 'Condução retomada com sucesso'
      });
    }

    return NextResponse.json({ error: 'Ação inválida' }, { status: 400 });
  } catch (error) {
    if (error instanceof Error && error.message === 'SESSION_CONFLICT') {
      return NextResponse.json({ error: 'A sessão mudou em outra solicitação. Atualize os dados.' }, { status: 409 });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
      return NextResponse.json({ error: 'A sessão mudou em outra solicitação. Atualize os dados.' }, { status: 409 });
    }
    // Tratar erro de autenticação
    if (error instanceof Error && error.message.startsWith('UNAUTHORIZED')) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    logError('Error managing driving session:', error);
    return NextResponse.json({ error: 'Erro ao gerenciar sessão' }, { status: 500 });
  }
}
