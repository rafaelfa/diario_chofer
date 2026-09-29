import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { calcKmTraveled, calcWorkDayHours } from '@/lib/time';
import { logError } from '@/lib/logger';
import { formatDatePtServer } from '@/lib/timezone';
import {
  aggregateDrivingByDate,
  computeDrivingLimits,
  evaluateDailyDrivingLimits,
  getMonday,
  MAX_BIWEEKLY_DRIVING_H,
  MAX_WEEKLY_DRIVING_H,
} from '@/lib/regulation561';
import { isValidTimezone, parseDateOnlyUtc } from '@/lib/validators';

// GET — Gerar relatórios do utilizador autenticado
export async function GET(request: NextRequest) {
  try {
    const { userId } = await requireAuth();

    const { searchParams } = new URL(request.url);
    const type            = searchParams.get('type') || 'weekly';
    const timezone        = searchParams.get('timezone');
    const requestedDate   = searchParams.get('date');
    const referenceDate   = requestedDate ? parseDateOnlyUtc(requestedDate) : new Date();
    const customStartDate = searchParams.get('startDate');
    const customEndDate   = searchParams.get('endDate');

    if (!['weekly', 'monthly', 'custom'].includes(type)) {
      return NextResponse.json({ error: 'Tipo de relatório inválido' }, { status: 400 });
    }
    if (!referenceDate || !isValidTimezone(timezone)) {
      return NextResponse.json({ error: 'Data ou fuso horário inválido' }, { status: 400 });
    }

    let startDate: Date;
    let endDate: Date;

    if (type === 'custom' && customStartDate && customEndDate) {
      const parsedStartDate = parseDateOnlyUtc(customStartDate);
      const parsedEndDate = parseDateOnlyUtc(customEndDate);
      if (!parsedStartDate || !parsedEndDate || parsedStartDate > parsedEndDate) {
        return NextResponse.json({ error: 'Período personalizado inválido' }, { status: 400 });
      }
      startDate = parsedStartDate;
      endDate = new Date(parsedEndDate);
      endDate.setUTCHours(23, 59, 59, 999);
    } else if (type === 'custom') {
      return NextResponse.json({ error: 'Datas de início e fim são obrigatórias' }, { status: 400 });
    } else if (type === 'weekly') {
      startDate = getMonday(referenceDate);
      endDate = new Date(startDate);
      endDate.setUTCDate(endDate.getUTCDate() + 7);
      endDate.setUTCMilliseconds(endDate.getUTCMilliseconds() - 1);
    } else {
      startDate = new Date(Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth(), 1));
      endDate = new Date(Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth() + 1, 0, 23, 59, 59, 999));
    }

    const workDays = await db.workDay.findMany({
      where: { userId, date: { gte: startDate, lte: endDate } },
      include: {
        events:          true,
        drivingSessions: { orderBy: { createdAt: 'asc' } },
      },
      orderBy: { date: 'asc' },
    });

    // ─── Estatísticas ────────────────────────────────────────────────
    let totalKm    = 0;
    let totalHours = 0;
    let totalEvents = 0;
    const alerts: string[] = [];

    const workDaysWithKm = workDays.map(day => {
      const sessions = day.drivingSessions ?? [];

      const kmTraveled  = calcKmTraveled(sessions, day.startKm, day.endKm) ?? 0;
      const hoursWorked = calcWorkDayHours(day) ?? 0;

      totalKm     += kmTraveled;
      totalHours  += hoursWorked;
      totalEvents += day.events.length;

      return {
        id:           day.id,
        date:         day.date,
        startTime:    day.startTime,
        endTime:      day.endTime,
        startCountry: day.startCountry,
        endCountry:   day.endCountry,
        kmTraveled:   kmTraveled ?? null,
        hoursWorked:  hoursWorked > 0 ? parseFloat(hoursWorked.toFixed(1)) : null,
        events:       day.events.length,
        sessionCount: sessions.length,
      };
    });

    let drivingLimits: ReturnType<typeof computeDrivingLimits> | null = null;
    if (type === 'weekly') {
      const dailyTotals = aggregateDrivingByDate(workDaysWithKm
        .filter(day => day.date !== null)
        .map(day => ({ date: day.date as Date, hoursWorked: day.hoursWorked ?? 0 })));
      const previousWeekStart = new Date(startDate);
      previousWeekStart.setUTCDate(previousWeekStart.getUTCDate() - 7);
      const complianceDays = await db.workDay.findMany({
        where: { userId, date: { gte: previousWeekStart, lte: endDate } },
        select: {
          date: true,
          startTime: true,
          endTime: true,
          primaryDriverNumber: true,
          utcOffset: true,
          breakMinutes: true,
          breakStart: true,
          drivingSessions: { orderBy: { createdAt: 'asc' } },
        },
      });
      drivingLimits = computeDrivingLimits(
        complianceDays.filter(day => day.date).map(day => ({
          date: day.date as Date,
          hoursWorked: calcWorkDayHours(day) ?? 0,
        })),
        referenceDate
      );

      if (drivingLimits.weeklyHours > MAX_WEEKLY_DRIVING_H) {
        alerts.push(`Total semanal: ${drivingLimits.weeklyHours.toFixed(1)}h (limite: ${MAX_WEEKLY_DRIVING_H}h)`);
      }
      if (drivingLimits.biweeklyHours > MAX_BIWEEKLY_DRIVING_H) {
        alerts.push(`Total em duas semanas: ${drivingLimits.biweeklyHours.toFixed(1)}h (limite: ${MAX_BIWEEKLY_DRIVING_H}h)`);
      }

      const dailyLimits = evaluateDailyDrivingLimits(dailyTotals);
      for (const excess of dailyLimits.overAbsoluteLimit) {
        alerts.push(`Dia ${formatDatePtServer(excess.date, timezone)}: ${excess.hours.toFixed(1)}h (limite absoluto: 10h)`);
      }
      for (const excess of dailyLimits.exceededWeeklyExceptions) {
        alerts.push(`Dia ${formatDatePtServer(excess.date, timezone)}: ${excess.hours.toFixed(1)}h; já foram usadas as duas exceções semanais de 10h`);
      }
    }

    const daysWorked = new Set(workDays
      .filter(day => day.date !== null)
      .map(day => day.date!.toISOString().slice(0, 10))).size;

    return NextResponse.json({
      period: { start: startDate, end: endDate, type },
      statistics: {
        daysWorked,
        totalKm,
        totalHours:      parseFloat(totalHours.toFixed(1)),
        totalEvents,
        avgHoursPerDay:  daysWorked > 0 ? parseFloat((totalHours / daysWorked).toFixed(1)) : 0,
        avgKmPerDay:     daysWorked > 0 ? Math.round(totalKm / daysWorked) : 0,
      },
      alerts,
      drivingLimits,
      workDays: workDaysWithKm,
    });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('UNAUTHORIZED')) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    logError('Error generating report:', error);
    return NextResponse.json({ error: 'Erro ao gerar relatório' }, { status: 500 });
  }
}
