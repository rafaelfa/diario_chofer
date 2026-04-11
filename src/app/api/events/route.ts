import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { logError } from '@/lib/logger';

// GET - Listar eventos DO USUÁRIO LOGADO (opcionalmente filtrados por dia)
export async function GET(request: NextRequest) {
  try {
    // ✅ ISOLAMENTO: Verificar autenticação
    const { userId } = await requireAuth();

    const { searchParams } = new URL(request.url);
    const workDayId = searchParams.get('workDayId');

    // ✅ ISOLAMENTO: Filtrar sempre por userId
    const events = await db.event.findMany({
      where: {
        userId,  // ← OBRIGATÓRIO: isolamento por usuário
        ...(workDayId ? { workDayId } : {})
      },
      include: {
        workDay: {
          select: {
            date: true
          }
        }
      },
      orderBy: [
        { workDay: { date: 'desc' } },
        { time: 'asc' }
      ]
    });

    return NextResponse.json(events);
  } catch (error) {
    // Tratar erro de autenticação
    if (error instanceof Error && error.message.startsWith('UNAUTHORIZED')) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    logError('Error fetching events:', error);
    return NextResponse.json({ error: 'Erro ao buscar eventos' }, { status: 500 });
  }
}

// POST - Criar novo evento (associado ao usuário logado)
export async function POST(request: NextRequest) {
  try {
    // ✅ ISOLAMENTO: Verificar autenticação
    const { userId } = await requireAuth();

    const body = await request.json();
    const { workDayId, time, description } = body;

    // ✅ ISOLAMENTO: Verificar se o workDay pertence ao usuário
    const workDay = await db.workDay.findFirst({
      where: {
        id: workDayId,
        userId  // ← OBRIGATÓRIO: só pode criar evento em dias do próprio usuário
      }
    });

    if (!workDay) {
      return NextResponse.json({ error: 'Dia de trabalho não encontrado' }, { status: 404 });
    }

    const event = await db.event.create({
      data: {
        workDayId,
        userId,  // ← OBRIGATÓRIO: associar ao usuário logado
        time,
        description
      },
      include: {
        workDay: {
          select: {
            date: true
          }
        }
      }
    });

    return NextResponse.json(event);
  } catch (error) {
    // Tratar erro de autenticação
    if (error instanceof Error && error.message.startsWith('UNAUTHORIZED')) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    logError('Error creating event:', error);
    return NextResponse.json({ error: 'Erro ao criar evento' }, { status: 500 });
  }
}
