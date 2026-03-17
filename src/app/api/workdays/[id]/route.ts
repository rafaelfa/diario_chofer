import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET - Buscar dia de trabalho por ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const workDay = await db.workDay.findUnique({
      where: { id },
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

    // Adicionar campos calculados
    const kmTraveled = workDay.endKm && workDay.startKm ? workDay.endKm - workDay.startKm : null;

    let hoursWorked: number | null = null;
    if (workDay.startTime && workDay.endTime) {
      const [startH, startM] = workDay.startTime.split(':').map(Number);
      const [endH, endM] = workDay.endTime.split(':').map(Number);
      const startMinutes = startH * 60 + startM;
      const endMinutes = endH * 60 + endM;
      hoursWorked = (endMinutes - startMinutes) / 60;
      if (hoursWorked < 0) hoursWorked += 24;
    }

    return NextResponse.json({
      ...workDay,
      kmTraveled,
      hoursWorked: hoursWorked ? parseFloat(hoursWorked.toFixed(2)) : null,
      totalEvents: workDay.events.length,
      // Último KM registrado (útil para pausar/retomar)
      lastSessionKm: workDay.drivingSessions?.length > 0 
        ? (workDay.drivingSessions[workDay.drivingSessions.length - 1].endKm || workDay.drivingSessions[workDay.drivingSessions.length - 1].startKm)
        : workDay.startKm
    });
  } catch (error) {
    console.error('Error fetching work day:', error);
    return NextResponse.json({ error: 'Erro ao buscar dia de trabalho' }, { status: 500 });
  }
}

// PUT - Atualizar dia de trabalho
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    
    console.log('PUT recebido:', JSON.stringify(body, null, 2));

    // Só atualiza os campos que foram enviados no body
    const dataToUpdate: Record<string, unknown> = {};
    
    if (body.date !== undefined) dataToUpdate.date = new Date(body.date);
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

    console.log('Dados a atualizar:', JSON.stringify(dataToUpdate, null, 2));

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

    console.log('Registro atualizado:', JSON.stringify(workDay, null, 2));

    return NextResponse.json(workDay);
  } catch (error) {
    console.error('Error updating work day:', error);
    return NextResponse.json({ error: 'Erro ao atualizar dia de trabalho' }, { status: 500 });
  }
}

// DELETE - Deletar dia de trabalho
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    await db.workDay.delete({
      where: { id }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting work day:', error);
    return NextResponse.json({ error: 'Erro ao deletar dia de trabalho' }, { status: 500 });
  }
}
