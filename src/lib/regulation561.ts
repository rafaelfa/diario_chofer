/**
 * Constantes e cálculos do Regulamento (CE) 561/2006 — Art. 6º
 *
 * Condução:
 *   Diária:      9h (exceção: 10h, máx. 2x/semana)
 *   Semanal:     56h
 *   Quinzenal:   90h (soma de 2 semanas consecutivas)
 *
 * Descanso:
 *   Diário:      11h (reduzível p/ 9h, máx. 3x/semana)
 *   Semanal:     45h (ou ≥24h com compensação)
 */

export const MAX_DAILY_DRIVING_H = 9;
export const MAX_DAILY_DRIVING_EXCEPTION_H = 10;
export const MAX_WEEKLY_DRIVING_H = 56;
export const MAX_BIWEEKLY_DRIVING_H = 90;

/** Retorna segunda-feira da semana ISO que contém a data */
export function getMonday(d: Date): Date {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = date.getUTCDay(); // 0=dom ... 6=sáb
  const diff = day === 0 ? -6 : 1 - day;
  date.setUTCDate(date.getUTCDate() + diff);
  return date;
}

export function getIsoWeekNumberUtc(date: Date): number {
  const thursday = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const weekday = (thursday.getUTCDay() + 6) % 7;
  thursday.setUTCDate(thursday.getUTCDate() - weekday + 3);

  const firstThursday = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 4));
  const firstWeekday = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstWeekday + 3);
  return 1 + Math.round((thursday.getTime() - firstThursday.getTime()) / (7 * 24 * 60 * 60 * 1000));
}

function dateKey(value: string | Date): string {
  return value instanceof Date ? value.toISOString().slice(0, 10) : value.slice(0, 10);
}

export function aggregateDrivingByDate(
  days: { date: string | Date; hoursWorked: number }[]
): Array<{ date: Date; hours: number }> {
  const totals = new Map<string, { date: Date; hours: number }>();
  for (const day of days) {
    const key = dateKey(day.date);
    const total = totals.get(key) ?? { date: new Date(`${key}T00:00:00.000Z`), hours: 0 };
    total.hours += day.hoursWorked;
    totals.set(key, total);
  }
  return [...totals.values()].sort((a, b) => a.date.getTime() - b.date.getTime());
}

export function evaluateDailyDrivingLimits(days: Array<{ date: Date; hours: number }>) {
  const overAbsoluteLimit = days.filter(day => day.hours > MAX_DAILY_DRIVING_EXCEPTION_H);
  const exceptionsByWeek = new Map<string, Array<{ date: Date; hours: number }>>();

  for (const day of days) {
    if (day.hours <= MAX_DAILY_DRIVING_H || day.hours > MAX_DAILY_DRIVING_EXCEPTION_H) continue;
    const weekKey = getMonday(day.date).toISOString().slice(0, 10);
    const exceptions = exceptionsByWeek.get(weekKey) ?? [];
    exceptions.push(day);
    exceptionsByWeek.set(weekKey, exceptions);
  }

  const exceededWeeklyExceptions = [...exceptionsByWeek.values()]
    .flatMap(exceptions => exceptions.sort((a, b) => a.date.getTime() - b.date.getTime()).slice(2))
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  return { overAbsoluteLimit, exceededWeeklyExceptions };
}

export interface DrivingLimitResult {
  weeklyHours: number;
  biweeklyHours: number;
  weeklyStatus: 'ok' | 'warning' | 'danger';
  biweeklyStatus: 'ok' | 'warning' | 'danger';
}

/**
 * Soma horas de condução da semana corrente e das duas semanas correntes.
 * days: lista de dias com { date: string|Date, hoursWorked: number }
 */
export function computeDrivingLimits(
  days: { date: string | Date; hoursWorked: number }[],
  reference: Date = new Date()
): DrivingLimitResult {
  const mondayThisWeek = getMonday(reference);
  const mondayPrevWeek = new Date(mondayThisWeek);
  mondayPrevWeek.setUTCDate(mondayPrevWeek.getUTCDate() - 7);
  const mondayNextWeek = new Date(mondayThisWeek);
  mondayNextWeek.setUTCDate(mondayNextWeek.getUTCDate() + 7);
  const thisWeekKey = mondayThisWeek.toISOString().slice(0, 10);
  const previousWeekKey = mondayPrevWeek.toISOString().slice(0, 10);
  const nextWeekKey = mondayNextWeek.toISOString().slice(0, 10);

  let weeklyHours = 0;
  let biweeklyHours = 0;

  for (const d of days) {
    const key = dateKey(d.date);
    if (key >= thisWeekKey && key < nextWeekKey) {
      weeklyHours += d.hoursWorked;
      biweeklyHours += d.hoursWorked;
    } else if (key >= previousWeekKey && key < thisWeekKey) {
      biweeklyHours += d.hoursWorked;
    }
  }

  const statusOf = (h: number, max: number): 'ok' | 'warning' | 'danger' =>
    h > max ? 'danger' : h > max * 0.9 ? 'warning' : 'ok';

  return {
    weeklyHours: Math.round(weeklyHours * 10) / 10,
    biweeklyHours: Math.round(biweeklyHours * 10) / 10,
    weeklyStatus: statusOf(weeklyHours, MAX_WEEKLY_DRIVING_H),
    biweeklyStatus: statusOf(biweeklyHours, MAX_BIWEEKLY_DRIVING_H),
  };
}
