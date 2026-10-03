import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { requireAuth } from '@/lib/auth';
import { calcKmTraveled, calcWorkDayHours } from '@/lib/time';
import { log, logError } from '@/lib/logger';
import { isValidTimeString, parseDateOnlyUtc, parseNonNegativeInteger, validateMatricula } from '@/lib/validators';

// GET — Listar todos os dias de trabalho do utilizador autenticado
export async function GET(request: NextRequest) {
  try {
    const { userId } = await requireAuth();

    const { searchParams } = new URL(request.url);
    const from = searchParams.get('from');
    const to   = searchParams.get('to');

    const where: Prisma.WorkDayWhereInput = { userId };

    if (from || to) {
      const fromDate = from ? parseDateOnlyUtc(from) : null;
      const toDate = to ? parseDateOnlyUtc(to) : null;
      if ((from && !fromDate) || (to && !toDate) || (fromDate && toDate && fromDate > toDate)) {
        return NextResponse.json({ error: 'Intervalo de datas inválido' }, { status: 400 });
      }
      if (toDate) toDate.setUTCHours(23, 59, 59, 999);
      where.date = { ...(fromDate ? { gte: fromDate } : {}), ...(toDate ? { lte: toDate } : {}) };
    }

    const workDays = await db.workDay.findMany({
      where,
      include: {
        events:          { orderBy: { time: 'asc' } },
        drivingSessions: { orderBy: { createdAt: 'asc' } },
        workActivities:  { orderBy: { startedAt: 'asc' } },
      },
      orderBy: [{ date: 'desc' }, { startTime: 'desc' }],
    });

    const workDaysWithCalculations = workDays.map(day => {
      const sessions = day.drivingSessions ?? [];

      const kmTraveled  = calcKmTraveled(sessions, day.startKm, day.endKm);
      const hoursWorked = calcWorkDayHours(day);

      const lastSession   = sessions.at(-1);
      const lastSessionKm = lastSession?.endKm ?? lastSession?.startKm ?? null;

      return {
        ...day,
        kmTraveled,
        hoursWorked,
        totalEvents:  day.events.length,
        lastSessionKm,
        sessionCount: sessions.length,
        activeWorkActivity: day.workActivities.find(activity => !activity.endedAt) ?? null,
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

    const { date, startTime, startCountry, startKm, lastRest, truckCheck, matricula, numDrivers, primaryDriverNumber, timezone, utcOffset } = body;

    // Modo de arranque: 'driving' cria logo uma sessão de condução ativa;
    // 'service' abre a jornada em atividade sem condução (carregamento/abastecimento/...).
    const startMode = body.startMode === 'service' ? 'service' : 'driving';
    const ACTIVITY_TYPES = new Set(['loading', 'unloading', 'refueling', 'other']);
    const initialActivityType = ACTIVITY_TYPES.has(body.initialActivityType) ? body.initialActivityType : 'other';

    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: 'Data inválida' }, { status: 400 });
    }
    const workDate = new Date(`${date}T00:00:00.000Z`);
    if (Number.isNaN(workDate.getTime()) || workDate.toISOString().slice(0, 10) !== date) {
      return NextResponse.json({ error: 'Data inválida' }, { status: 400 });
    }

    // Validar formato da matrícula (AA-00-BB)
    if (matricula && typeof matricula !== 'string') {
      return NextResponse.json({ error: 'Matrícula inválida' }, { status: 400 });
    }
    if (matricula) {
      const { valid } = validateMatricula(matricula);
      if (!valid) {
        return NextResponse.json(
          { error: 'Formato de matrícula inválido. Use o formato AA-00-BB (ex: PT-12-AB)' },
          { status: 400 }
        );
      }
    }

    const parsedStartKm = parseNonNegativeInteger(startKm);
    if (!parsedStartKm.valid) {
      return NextResponse.json({ error: 'KM inicial deve ser um inteiro não negativo' }, { status: 400 });
    }
    const kmValue = parsedStartKm.value;

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

      if (lastRecord?.endKm != null && kmValue != null && kmValue < lastRecord.endKm) {
        return NextResponse.json(
          {
            error: `KM inicial (${kmValue}) não pode ser menor que o KM final do último registo deste caminhão (${lastRecord.endKm})`,
          },
          { status: 400 }
        );
      }
    }

    if (!isValidTimeString(startTime)) {
      return NextResponse.json(
        { error: 'startTime deve estar no formato HH:MM' },
        { status: 400 }
      );
    }

    const resolvedStartTime = startTime;
    const driverNumber = Number(numDrivers) === 2 && Number(primaryDriverNumber) === 2 ? 2 : 1;

    // Instante de início da atividade quando a jornada arranca em modo serviço:
    // data + hora local + offset registado no arranque.
    const resolvedOffset = typeof utcOffset === 'string' && /^[+-](?:0\d|1[0-4]):[0-5]\d$/.test(utcOffset) ? utcOffset : '+00:00';
    const parsedActivityStart = new Date(`${date}T${startTime}:00${resolvedOffset}`);
    const activityStartedAt = Number.isNaN(parsedActivityStart.getTime())
      ? new Date(`${date}T${startTime}:00Z`)
      : parsedActivityStart;

    const workDay = await db.$transaction(async transaction => {
      const openDay = await transaction.workDay.findFirst({ where: { userId, endTime: null }, select: { id: true } });
      if (openDay) throw new Error('WORKDAY_ALREADY_OPEN');

      return transaction.workDay.create({
        data: {
          userId,
          date:         workDate,
          startTime:    resolvedStartTime,
          startCountry: typeof startCountry === 'string' ? startCountry.trim() || null : null,
          startKm:      kmValue,
          lastRest:     typeof lastRest === 'string' ? lastRest.trim() || null : null,
          truckCheck:   truckCheck === true,
          matricula:    matricula ? matricula.toUpperCase() : null,
          numDrivers:   Number(numDrivers) === 2 ? 2 : 1,
          primaryDriverNumber: driverNumber,
          timezone:     typeof timezone === 'string' ? timezone : null,
          utcOffset:    typeof utcOffset === 'string' ? utcOffset : null,
          ...(startMode === 'driving'
            ? {
                drivingSessions: {
                  create: {
                    userId,
                    startTime: resolvedStartTime,
                    startKm:   kmValue,
                    status:    'active',
                    driverNumber,
                    utcOffset: typeof utcOffset === 'string' ? utcOffset : null,
                  },
                },
              }
            : {
                workActivities: {
                  create: {
                    userId,
                    driverNumber,
                    type: initialActivityType,
                    startedAt: activityStartedAt,
                    startKm: kmValue,
                  },
                },
              }),
        },
        include: { events: true, drivingSessions: true, workActivities: true },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    log('POST /api/workdays — criado id:', workDay.id);

    return NextResponse.json({
      ...workDay,
      activeWorkActivity: workDay.workActivities.find(activity => !activity.endedAt) ?? null,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'WORKDAY_ALREADY_OPEN') {
      return NextResponse.json({ error: 'Finalize a jornada aberta antes de iniciar outra' }, { status: 409 });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
      return NextResponse.json({ error: 'Outra jornada foi iniciada ao mesmo tempo. Atualize os dados.' }, { status: 409 });
    }
    if (error instanceof Error && error.message.startsWith('UNAUTHORIZED')) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    logError('Error creating work day:', error);
    return NextResponse.json({ error: 'Erro ao criar dia de trabalho' }, { status: 500 });
  }
}
