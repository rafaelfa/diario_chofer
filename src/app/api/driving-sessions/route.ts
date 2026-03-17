import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET - Buscar sessões de um dia de trabalho
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const workDayId = searchParams.get('workDayId');

    if (!workDayId) {
      return NextResponse.json({ error: 'workDayId é obrigatório' }, { status: 400 });
    }

    const sessions = await db.drivingSession.findMany({
      where: { workDayId },
      orderBy: { startTime: 'asc' }
    });

    // Calcular totais
    const totalKm = sessions.reduce((acc, s) => {
      if (s.startKm && s.endKm) {
        return acc + (s.endKm - s.startKm);
      }
      return acc;
    }, 0);

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
    console.error('Error fetching driving sessions:', error);
    return NextResponse.json({ error: 'Erro ao buscar sessões' }, { status: 500 });
  }
}

// POST - Pausar sessão atual ou criar nova sessão (retomar)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { workDayId, action, currentKm } = body;

    if (!workDayId || !action) {
      return NextResponse.json({ error: 'workDayId e action são obrigatórios' }, { status: 400 });
    }

    // Buscar o work day
    const workDay = await db.workDay.findUnique({
      where: { id: workDayId },
      include: {
        drivingSessions: {
          orderBy: { startTime: 'asc' }
        }
      }
    });

    if (!workDay) {
      return NextResponse.json({ error: 'Dia de trabalho não encontrado' }, { status: 404 });
    }

    const now = new Date();
    const currentTime = now.toTimeString().slice(0, 5);

    if (action === 'pause') {
      // PAUSAR: Encerrar sessão ativa e marcar workDay como pausado
      const activeSession = workDay.drivingSessions.find(s => !s.endTime);

      if (activeSession) {
        // Atualizar sessão ativa com KM final
        await db.drivingSession.update({
          where: { id: activeSession.id },
          data: {
            endTime: currentTime,
            endKm: currentKm ? parseInt(String(currentKm)) : null,
            status: 'paused'
          }
        });
      }

      // Marcar workDay como pausado
      const updatedWorkDay = await db.workDay.update({
        where: { id: workDayId },
        data: { isPaused: true },
        include: {
          events: true,
          drivingSessions: true
        }
      });

      return NextResponse.json({
        ...updatedWorkDay,
        message: 'Condução pausada com sucesso'
      });
    }

    if (action === 'resume') {
      // RETOMAR: Criar nova sessão a partir do KM atual
      // O KM inicial da nova sessão deve ser o último KM registrado
      const lastSession = workDay.drivingSessions[workDay.drivingSessions.length - 1];
      const startKm = currentKm ? parseInt(String(currentKm)) : (lastSession?.endKm || workDay.startKm);

      // Criar nova sessão
      await db.drivingSession.create({
        data: {
          workDayId,
          startTime: currentTime,
          startKm: startKm,
          status: 'active'
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

      return NextResponse.json({
        ...updatedWorkDay,
        message: 'Condução retomada com sucesso'
      });
    }

    return NextResponse.json({ error: 'Ação inválida' }, { status: 400 });
  } catch (error) {
    console.error('Error managing driving session:', error);
    return NextResponse.json({ error: 'Erro ao gerenciar sessão' }, { status: 500 });
  }
}
