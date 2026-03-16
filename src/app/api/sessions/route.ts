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

    return NextResponse.json(sessions);
  } catch (error) {
    console.error('Erro ao buscar sessões:', error);
    return NextResponse.json({ error: 'Erro ao buscar sessões' }, { status: 500 });
  }
}

// POST - Criar nova sessão ou pausar atual
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { workDayId, action, km, time } = body;

    if (!workDayId || !action) {
      return NextResponse.json({ error: 'workDayId e action são obrigatórios' }, { status: 400 });
    }

    const now = time || new Date().toTimeString().slice(0, 5);

    if (action === 'pause') {
      // Pausar condução - finalizar sessão ativa
      if (!km) {
        return NextResponse.json({ error: 'KM é obrigatório para pausar' }, { status: 400 });
      }

      // Buscar sessão ativa
      const activeSession = await db.drivingSession.findFirst({
        where: { workDayId, status: 'active' }
      });

      if (!activeSession) {
        return NextResponse.json({ error: 'Nenhuma sessão ativa encontrada' }, { status: 400 });
      }

      // Finalizar sessão ativa
      const updatedSession = await db.drivingSession.update({
        where: { id: activeSession.id },
        data: {
          endTime: now,
          endKm: parseInt(km),
          status: 'paused'
        }
      });

      // Marcar dia como pausado
      await db.workDay.update({
        where: { id: workDayId },
        data: { isPaused: true }
      });

      // Calcular KM do turno
      const kmDriven = activeSession.startKm ? parseInt(km) - activeSession.startKm : null;

      return NextResponse.json({
        session: updatedSession,
        kmDriven,
        message: kmDriven ? `Turno finalizado: ${kmDriven}km rodados` : 'Turno finalizado'
      });
    }

    if (action === 'resume') {
      // Retomar condução - criar nova sessão
      if (!km) {
        return NextResponse.json({ error: 'KM é obrigatório para retomar' }, { status: 400 });
      }

      // Criar nova sessão
      const newSession = await db.drivingSession.create({
        data: {
          workDayId,
          startTime: now,
          startKm: parseInt(km),
          status: 'active'
        }
      });

      // Marcar dia como não pausado
      await db.workDay.update({
        where: { id: workDayId },
        data: { isPaused: false }
      });

      return NextResponse.json({
        session: newSession,
        message: 'Condução retomada'
      });
    }

    if (action === 'start') {
      // Iniciar primeira sessão do dia
      const existingActive = await db.drivingSession.findFirst({
        where: { workDayId, status: 'active' }
      });

      if (existingActive) {
        return NextResponse.json({ error: 'Já existe uma sessão ativa' }, { status: 400 });
      }

      const newSession = await db.drivingSession.create({
        data: {
          workDayId,
          startTime: now,
          startKm: km ? parseInt(km) : null,
          status: 'active'
        }
      });

      return NextResponse.json({
        session: newSession,
        message: 'Condução iniciada'
      });
    }

    return NextResponse.json({ error: 'Ação inválida' }, { status: 400 });
  } catch (error) {
    console.error('Erro ao processar sessão:', error);
    return NextResponse.json({ error: 'Erro ao processar sessão' }, { status: 500 });
  }
}
