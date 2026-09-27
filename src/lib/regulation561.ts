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
  const date = new Date(d);
  const day = date.getDay(); // 0=dom ... 6=sáb
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
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
  mondayPrevWeek.setDate(mondayPrevWeek.getDate() - 7);

  let weeklyHours = 0;
  let biweeklyHours = 0;

  for (const d of days) {
    const dd = new Date(d.date);
    dd.setHours(0, 0, 0, 0);
    if (dd >= mondayThisWeek) {
      weeklyHours += d.hoursWorked;
      biweeklyHours += d.hoursWorked;
    } else if (dd >= mondayPrevWeek) {
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
