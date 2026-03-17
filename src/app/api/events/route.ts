import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET - Listar eventos (opcionalmente filtrados por dia)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const workDayId = searchParams.get('workDayId');

    const events = await db.event.findMany({
      where: workDayId ? { workDayId } : undefined,
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
    console.error('Error fetching events:', error);
    return NextResponse.json({ error: 'Erro ao buscar eventos' }, { status: 500 });
  }
}

// POST - Criar novo evento
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { workDayId, time, description } = body;

    const event = await db.event.create({
      data: {
        workDayId,
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
    console.error('Error creating event:', error);
    return NextResponse.json({ error: 'Erro ao criar evento' }, { status: 500 });
  }
}
