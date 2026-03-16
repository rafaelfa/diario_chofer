import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';

// GET - Listar todos os dias de trabalho
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const id = searchParams.get('id');

    // Se passar ID, buscar apenas um
    if (id) {
      const day = await db.workDay.findUnique({
        where: { id },
        include: {
          events: { orderBy: { time: 'asc' } },
          drivingSessions: { orderBy: { startTime: 'asc' } }
        }
      });

      if (!day) {
        return NextResponse.json({ error: 'Dia não encontrado' }, { status: 404 });
      }

      // Calcular totais baseados nas sessões
      let totalKm = 0;
      let totalMinutes = 0;

      for (const session of day.drivingSessions) {
        if (session.startKm && session.endKm) {
          totalKm += session.endKm - session.startKm;
        }
        if (session.startTime && session.endTime) {
          const [startH, startM] = session.startTime.split(':').map(Number);
          const [endH, endM] = session.endTime.split(':').map(Number);
          const startMin = startH * 60 + startM;
          const endMin = endH * 60 + endM;
          totalMinutes += endMin > startMin ? endMin - startMin : (24 * 60 - startMin) + endMin;
        }
      }

      return NextResponse.json({
        ...day,
        kmTraveled: totalKm || null,
        hoursWorked: totalMinutes > 0 ? parseFloat((totalMinutes / 60).toFixed(2)) : null,
        totalEvents: day.events.length
      });
    }

    const where: Prisma.WorkDayWhereInput = {};

    if (from || to) {
      where.date = {};
      if (from) where.date.gte = new Date(from);
      if (to) where.date.lte = new Date(to);
    }

    const workDays = await db.workDay.findMany({
      where,
      include: {
        events: {
          orderBy: { time: 'asc' }
        },
        drivingSessions: {
          orderBy: { startTime: 'asc' }
        }
      },
      orderBy: [
        { date: 'desc' },
        { startTime: 'desc' }
      ]
    });

    // Adicionar campos calculados baseados nas sessões
    const workDaysWithCalculations = workDays.map(day => {
      let totalKm = 0;
      let totalMinutes = 0;

      for (const session of day.drivingSessions) {
        if (session.startKm && session.endKm) {
          totalKm += session.endKm - session.startKm;
        }
        if (session.startTime && session.endTime) {
          const [startH, startM] = session.startTime.split(':').map(Number);
          const [endH, endM] = session.endTime.split(':').map(Number);
          const startMin = startH * 60 + startM;
          const endMin = endH * 60 + endM;
          totalMinutes += endMin > startMin ? endMin - startMin : (24 * 60 - startMin) + endMin;
        }
      }

      return {
        ...day,
        kmTraveled: totalKm || null,
        hoursWorked: totalMinutes > 0 ? parseFloat((totalMinutes / 60).toFixed(2)) : null,
        totalEvents: day.events.length
      };
    });

    return NextResponse.json(workDaysWithCalculations);
  } catch (error) {
    console.error('Error fetching work days:', error);
    return NextResponse.json({ error: 'Erro ao buscar dias de trabalho' }, { status: 500 });
  }
}

// POST - Criar novo dia de trabalho (sempre cria novo)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('=== RECEBENDO DADOS ===');
    console.log('Body completo:', JSON.stringify(body, null, 2));
    console.log('startKm recebido:', body.startKm, 'tipo:', typeof body.startKm);

    const {
      date,
      startTime,
      startCountry,
      startKm,
      lastRest,
      truckCheck,
      matricula
    } = body;

    // Validar formato da matrícula (formato europeu: AA-00-BB ou AA-00-00)
    if (matricula) {
      const matriculaRegex = /^[A-Z]{2}-\d{2}-[A-Z0-9]{2}$/;
      if (!matriculaRegex.test(matricula.toUpperCase())) {
        return NextResponse.json({
          error: 'Formato de matrícula inválido. Use o formato AA-00-BB (ex: PT-12-AB)'
        }, { status: 400 });
      }
    }

    // Se tiver matrícula e KM inicial, validar contra último registro
    if (matricula && startKm) {
      const kmValue = parseInt(String(startKm), 10);
      const lastRecord = await db.workDay.findFirst({
        where: {
          matricula: matricula.toUpperCase(),
          endTime: { not: null } // Apenas registros finalizados
        },
        orderBy: { date: 'desc' },
        select: { endKm: true, date: true }
      });

      if (lastRecord && lastRecord.endKm && kmValue < lastRecord.endKm) {
        return NextResponse.json({
          error: `KM inicial (${kmValue}) não pode ser menor que o KM final do último registro deste caminhão (${lastRecord.endKm})`
        }, { status: 400 });
      }
    }

    // Converter a data para o início do dia (UTC)
    const workDate = new Date(date);
    workDate.setHours(0, 0, 0, 0);

    // Preparar dados - converter startKm para número
    const kmValue = startKm ? parseInt(String(startKm), 10) : null;
    console.log('KM convertido:', kmValue, 'tipo:', typeof kmValue);

    const actualStartTime = startTime || new Date().toTimeString().slice(0, 5);

    const dataToSave = {
      date: workDate,
      startTime: actualStartTime,
      startCountry: startCountry || null,
      startKm: kmValue,
      lastRest: lastRest || null,
      truckCheck: Boolean(truckCheck),
      matricula: matricula ? matricula.toUpperCase() : null,
    };

    console.log('=== DADOS A SALVAR ===');
    console.log(JSON.stringify(dataToSave, null, 2));

    // Criar o dia de trabalho
    const workDay = await db.workDay.create({
      data: dataToSave,
      include: {
        events: true
      }
    });

    // Criar primeira sessão de condução automaticamente
    await db.drivingSession.create({
      data: {
        workDayId: workDay.id,
        startTime: actualStartTime,
        startKm: kmValue,
        status: 'active'
      }
    });

    // Buscar novamente com as sessões
    const workDayWithSessions = await db.workDay.findUnique({
      where: { id: workDay.id },
      include: {
        events: true,
        drivingSessions: true
      }
    });

    console.log('=== REGISTRO CRIADO ===');
    console.log(JSON.stringify(workDayWithSessions, null, 2));

    return NextResponse.json(workDayWithSessions);
  } catch (error) {
    console.error('Error creating work day:', error);
    return NextResponse.json({ error: 'Erro ao criar dia de trabalho' }, { status: 500 });
  }
}
