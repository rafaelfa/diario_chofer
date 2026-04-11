import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { requireAuth } from '@/lib/auth';
import { calcHoursWorked, calcKmTraveled } from '@/lib/time';
import { log, logError } from '@/lib/logger';
import { validateMatricula } from '@/lib/validators';

// GET — Listar todos os dias de trabalho do utilizador autenticado
export async function GET(request: NextRequest) {
  try {
    const { userId } = await requireAuth();

    const { searchParams } = new URL(request.url);
    const from = searchParams.get('from');
    const to   = searchParams.get('to');

    const where: Prisma.WorkDayWhereInput = { userId };

    if (from || to) {
      where.date = {};
      if (from) where.date.gte = new Date(from);
      if (to)   where.date.lte = new Date(to);
    }

    const workDays = await db.workDay.findMany({
      where,
      include: {
        events:          { orderBy: { time: 'asc' } },
        drivingSessions: { orderBy: { startTime: 'asc' } },
      },
      orderBy: [{ date: 'desc' }, { startTime: 'desc' }],
    });

    const workDaysWithCalculations = workDays.map(day => {
      const sessions = day.drivingSessions ?? [];

      const kmTraveled  = calcKmTraveled(sessions, day.startKm, day.endKm);
      const hoursWorked = calcHoursWorked(sessions, day.startTime, day.endTime);

      const lastSession   = sessions.at(-1);
      const lastSessionKm = lastSession?.endKm ?? lastSession?.startKm ?? null;

      return {
        ...day,
        kmTraveled,
        hoursWorked,
        totalEvents:  day.events.length,
        lastSessionKm,
        sessionCount: sessions.length,
      };
    });

    return NextResponse.json(workDaysWithCalculations);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('UNAUTHORIZED')) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    logError('Error fetching work days:', error);
    return NextResponse.json({ error: 'Erro ao buscar dias de trabalho' }, { status: 500 });
  }
}

// POST — Criar novo dia de trabalho
export async function POST(request: NextRequest) {
  try {
    const { userId } = await requireAuth();
    const body = await request.json();

    log('POST /api/workdays — body recebido');  // sem dados sensíveis em prod

    const { date, startTime, startCountry, startKm, lastRest, truckCheck, matricula, numDrivers, timezone, utcOffset } = body;

    // Validar formato da matrícula (AA-00-BB)
    if (matricula) {
      const { valid } = validateMatricula(matricula);
      if (!valid) {
        return NextResponse.json(
          { error: 'Formato de matrícula inválido. Use o formato AA-00-BB (ex: PT-12-AB)' },
          { status: 400 }
        );
      }
    }

    const kmValue = startKm ? parseInt(String(startKm), 10) : null;

    // Validar KM contra último registo do utilizador para o mesmo veículo
    if (matricula && kmValue !== null) {
      const lastRecord = await db.workDay.findFirst({
        where: {
          userId,
          matricula: matricula.toUpperCase(),
          endTime: { not: null },
        },
        orderBy: { date: 'desc' },
        select: { endKm: true },
      });

      if (lastRecord?.endKm && kmValue < lastRecord.endKm) {
        return NextResponse.json(
          {
            error: `KM inicial (${kmValue}) não pode ser menor que o KM final do último registo deste caminhão (${lastRecord.endKm})`,
          },
          { status: 400 }
        );
      }
    }

    const workDate = new Date(date);
    workDate.setHours(0, 0, 0, 0);

    // ⚠️ O cliente DEVE enviar startTime (hora local do browser).
    // Se não foi enviado, é um bug do cliente — logar e rejeitar.
    if (!startTime) {
      return NextResponse.json(
        { error: 'startTime é obrigatório (hora local do dispositivo)' },
        { status: 400 }
      );
    }

    const resolvedStartTime = startTime;

    const workDay = await db.workDay.create({
      data: {
        userId,
        date:         workDate,
        startTime:    resolvedStartTime,
        startCountry: startCountry || null,
        startKm:      kmValue,
        lastRest:     lastRest || null,
        truckCheck:   Boolean(truckCheck),
        matricula:    matricula ? matricula.toUpperCase() : null,
        numDrivers:   numDrivers === 2 ? 2 : 1,
        timezone:     timezone || null,
        utcOffset:    utcOffset || null,
        drivingSessions: {
          create: {
            userId,
            startTime: resolvedStartTime,
            startKm:   kmValue,
            status:    'active',
            utcOffset: utcOffset || null,
          },
        },
      },
      include: {
        events:          true,
        drivingSessions: true,
      },
    });

    log('POST /api/workdays — criado id:', workDay.id);

    return NextResponse.json(workDay);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('UNAUTHORIZED')) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    logError('Error creating work day:', error);
    return NextResponse.json({ error: 'Erro ao criar dia de trabalho' }, { status: 500 });
  }
}
