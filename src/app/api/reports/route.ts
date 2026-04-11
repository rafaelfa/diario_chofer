import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { calcHoursWorked, calcKmTraveled, MAX_DAY_HOURS } from '@/lib/time';
import { logError } from '@/lib/logger';
import { formatDatePtServer } from '@/lib/timezone';

// GET — Gerar relatórios do utilizador autenticado
export async function GET(request: NextRequest) {
  try {
    const { userId } = await requireAuth();

    const { searchParams } = new URL(request.url);
    const type            = searchParams.get('type') || 'weekly';
    const timezone        = searchParams.get('timezone');
    const referenceDate   = searchParams.get('date') ? new Date(searchParams.get('date')!) : new Date();
    const customStartDate = searchParams.get('startDate');
    const customEndDate   = searchParams.get('endDate');

    let startDate: Date;
    let endDate: Date;

    if (type === 'custom' && customStartDate && customEndDate) {
      startDate = new Date(customStartDate);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(customEndDate);
      endDate.setHours(23, 59, 59, 999);
    } else if (type === 'weekly') {
      const dayOfWeek = referenceDate.getDay();
      const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      startDate = new Date(referenceDate);
      startDate.setDate(referenceDate.getDate() - diff);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 6);
      endDate.setHours(23, 59, 59, 999);
    } else {
      startDate = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 0);
      endDate.setHours(23, 59, 59, 999);
    }

    const workDays = await db.workDay.findMany({
      where: { userId, date: { gte: startDate, lte: endDate } },
      include: {
        events:          true,
        drivingSessions: { orderBy: { startTime: 'asc' } },
      },
      orderBy: { date: 'asc' },
    });

    // ─── Estatísticas ────────────────────────────────────────────────
    let totalKm    = 0;
    let totalHours = 0;
    let totalEvents = 0;
    const alerts: string[] = [];
    const maxDailyHours  = 9;
    const maxWeeklyHours = 56;

    const workDaysWithKm = workDays.map(day => {
      const sessions = day.drivingSessions ?? [];

      const kmTraveled  = calcKmTraveled(sessions, day.startKm, day.endKm) ?? 0;
      // Calcular horas: usar sessões completadas OU fallback startTime/endTime
      let rawHours = calcHoursWorked(sessions, day.startTime, day.endTime) ?? 0;

      // Proteção dupla: limitar a 15h por dia (ninguém conduz mais que 15h por dia)
      // Isto previne bugs de dados (ex: endTime no dia seguinte por erro de fuso)
      const hoursWorked = Math.min(rawHours, MAX_DAY_HOURS);

      totalKm     += kmTraveled;
      totalHours  += hoursWorked;
      totalEvents += day.events.length;

      if (hoursWorked > maxDailyHours) {
        alerts.push(
          `Dia ${formatDatePtServer(day.date!, timezone)}: ${hoursWorked.toFixed(1)}h (limite: ${maxDailyHours}h)`
        );
      }

      return {
        id:           day.id,
        date:         day.date,
        startTime:    day.startTime,
        endTime:      day.endTime,
        startCountry: day.startCountry,
        endCountry:   day.endCountry,
        kmTraveled:   kmTraveled || null,
        hoursWorked:  hoursWorked > 0 ? parseFloat(hoursWorked.toFixed(1)) : null,
        events:       day.events.length,
        sessionCount: sessions.length,
      };
    });

    if (totalHours > maxWeeklyHours) {
      alerts.push(`Total semanal: ${totalHours.toFixed(1)}h (limite: ${maxWeeklyHours}h)`);
    }

    const daysWorked = workDays.length;

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
