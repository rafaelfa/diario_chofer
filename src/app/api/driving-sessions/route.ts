import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { calcKmTraveled } from '@/lib/time';
import { logError } from '@/lib/logger';

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
      where: { workDayId, userId },  // ← OBRIGATÓRIO: filtrar por userId
      orderBy: { startTime: 'asc' }
    });

    // Calcular totais
    const totalKm = calcKmTraveled(sessions) ?? 0;

    // Pegar último KM registrado
    const lastSession = sessions[sessions.length - 1];
    const lastKm = lastSession?.endKm || lastSession?.startKm || null;

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
    // ✅ ISOLAMENTO: Verificar autenticação
    const { userId } = await requireAuth();

    const body = await request.json();
    const { workDayId, action, currentKm, currentTime: clientTime, utcOffset: clientOffset } = body;

    if (!workDayId || !action) {
      return NextResponse.json({ error: 'workDayId e action são obrigatórios' }, { status: 400 });
    }

    // Buscar o work day DO USUÁRIO
    const workDay = await db.workDay.findFirst({
      where: { id: workDayId, userId },  // ← OBRIGATÓRIO: filtrar por userId
      include: {
        drivingSessions: {
          orderBy: { startTime: 'asc' }
        }
      }
    });

    if (!workDay) {
      return NextResponse.json({ error: 'Dia de trabalho não encontrado' }, { status: 404 });
    }

    // ⚠️ USAR HORA DO CLIENTE (não do servidor) para evitar bugs de fuso horário.
    // O cliente envia currentTime = hora local do browser.
    // Fallback: se o cliente não enviar, usar server time (último recurso).
    const currentTime = clientTime || new Date().toTimeString().slice(0, 5);
    const sessionOffset = clientOffset || null;

    if (action === 'pause') {
      // PAUSAR: Encerrar sessão ativa e marcar workDay como pausado
      const activeSession = workDay.drivingSessions.find(s => !s.endTime);

      if (activeSession) {
        // Atualizar sessão ativa com KM final e offset UTC
        await db.drivingSession.update({
          where: { id: activeSession.id },
          data: {
            endTime: currentTime,
            endKm: currentKm ? parseInt(String(currentKm)) : null,
            status: 'paused',
            utcOffset: sessionOffset,
          }
        });
      }

      // Marcar workDay como pausado
      const updatedWorkDay = await db.workDay.update({
        where: { id: workDayId },
        data: { isPaused: true },
        include: {
          events: true,
          drivingSessions: {
            orderBy: { startTime: 'asc' }
          }
        }
      });

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
      // RETOMAR: Criar nova sessão a partir do KM atual
      // O KM inicial da nova sessão deve ser o último KM registrado
      const prevLastSession = workDay.drivingSessions[workDay.drivingSessions.length - 1];
      const startKm = currentKm ? parseInt(String(currentKm)) : (prevLastSession?.endKm || workDay.startKm);

      // Criar nova sessão associada ao usuário, com offset UTC para auditoria
      await db.drivingSession.create({
        data: {
          workDayId,
          userId,  // ← OBRIGATÓRIO: associar ao usuário
          startTime: currentTime,
          startKm: startKm,
          status: 'active',
          utcOffset: sessionOffset,
        }
      });

      // Despausar workDay
      const updatedWorkDay = await db.workDay.update({
        where: { id: workDayId },
        data: { isPaused: false },
        include: {
          events: true,
          drivingSessions: {
            orderBy: { startTime: 'asc' }
          }
        }
      });

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
    // Tratar erro de autenticação
    if (error instanceof Error && error.message.startsWith('UNAUTHORIZED')) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    logError('Error managing driving session:', error);
    return NextResponse.json({ error: 'Erro ao gerenciar sessão' }, { status: 500 });
  }
}
