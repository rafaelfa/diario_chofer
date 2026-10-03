/**
 * Utilitários de tempo — centraliza cálculos usados em vários lugares da API.
 * Substitui os 32+ blocos duplicados de split(':').map(Number) espalhados pelo código.
 */

/**
 * Converte uma string "HH:MM" para minutos totais desde meia-noite.
 * Retorna null se o valor for inválido.
 */
export function parseTimeToMinutes(time: string | null | undefined): number | null {
  if (!time) return null;
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/**
 * Calcula a diferença em minutos entre dois tempos "HH:MM".
 * Lida com passagem de meia-noite (ex: 23:00 → 01:00 = 120 min).
 * Retorna null se algum dos tempos for inválido.
 * Protegido contra diferenças irreais (> 24h = 1440 min).
 */
export function diffInMinutes(
  startTime: string | null | undefined,
  endTime: string | null | undefined
): number | null {
  const start = parseTimeToMinutes(startTime);
  const end = parseTimeToMinutes(endTime);
  if (start === null || end === null) return null;

  let diff = end - start;
  if (diff < 0) diff += 24 * 60; // passou da meia-noite

  // Proteção: se a diferença for > 24h, provável erro de dados
  if (diff > 24 * 60) return null;

  return diff;
}

/**
 * Calcula as horas trabalhadas com base numa lista de sessões de condução.
 * Faz fallback para startTime/endTime do dia se não houver sessões com tempo.
 * Só conta sessões COMPLETAS (com startTime E endTime preenchidos).
 * Ignora sessões com duração > 12h (provável erro de dados).
 * Limita o total a 15h por dia (proteção contra bugs de fuso horário).
 */
export const MAX_DAY_HOURS = 15;      // Total diário nunca deve exceder 15h

export interface TimeCalculationOptions {
  currentTime?: string | null;
  breakMinutes?: number;
  /**
   * Atividades sem condução (carregamento, descarregamento, abastecimento, outro trabalho).
   * Nunca contam como condução — só na amplitude da jornada.
   */
  activities?: Array<{ startedAt: string | Date; endedAt?: string | Date | null }>;
  /** Offset UTC do registo, para converter os instantes das atividades em HH:MM */
  utcOffset?: string | null;
}

const MINUTES_PER_DAY = 24 * 60;

/**
 * Sobreposição entre um intervalo [itemStart, itemEnd] e a janela [windowStart, windowEnd],
 * em minutos desde a meia-noite. Testa também o intervalo deslocado +24h para cobrir
 * valores que atravessam a meia-noite. Sempre ≥ 0.
 */
function overlapMinutesClamped(itemStart: number, itemEnd: number, windowStart: number, windowEnd: number): number {
  const direct = Math.min(itemEnd, windowEnd) - Math.max(itemStart, windowStart);
  const shifted = Math.min(itemEnd + MINUTES_PER_DAY, windowEnd) - Math.max(itemStart + MINUTES_PER_DAY, windowStart);
  return Math.max(0, direct, shifted);
}

/**
 * Minutos de atividades sem condução contidos numa janela "HH:MM" → "HH:MM".
 * Atividade sem fim conta até ao fim da janela (está em curso).
 * Usado para garantir que carregamento/abastecimento nunca entram na condução.
 */
export function calcActivityMinutesInRange(
  activities: Array<{ startedAt: string | Date; endedAt?: string | Date | null }> | null | undefined,
  rangeStart: string | null | undefined,
  rangeEnd: string | null | undefined,
  utcOffset?: string | null
): number {
  if (!activities || activities.length === 0) return 0;

  const windowStart = parseTimeToMinutes(rangeStart);
  const parsedWindowEnd = parseTimeToMinutes(rangeEnd);
  if (windowStart === null || parsedWindowEnd === null) return 0;

  const windowEnd = parsedWindowEnd > windowStart ? parsedWindowEnd : parsedWindowEnd + MINUTES_PER_DAY;
  if (windowEnd <= windowStart) return 0;

  let total = 0;
  for (const activity of activities) {
    const start = parseTimeToMinutes(getTimeAtUtcOffset(new Date(activity.startedAt), utcOffset));
    if (start === null) continue;

    let end: number;
    if (activity.endedAt) {
      const parsedEnd = parseTimeToMinutes(getTimeAtUtcOffset(new Date(activity.endedAt), utcOffset));
      if (parsedEnd === null) continue;
      end = parsedEnd >= start ? parsedEnd : parsedEnd + MINUTES_PER_DAY;
    } else {
      end = windowEnd;
    }

    total += overlapMinutesClamped(start, end, windowStart, windowEnd);
  }

  return Math.min(total, windowEnd - windowStart);
}

export function calcDrivingMinutes(
  sessions: Array<{ startTime?: string | null; endTime?: string | null; status?: string; utcOffset?: string | null }>,
  fallbackStart?: string | null,
  fallbackEnd?: string | null,
  options: TimeCalculationOptions = {}
): number | null {
  const timedSessions = sessions.filter(session =>
    session.startTime && (session.endTime || (session.status === 'active' && options.currentTime))
  );

  let totalMinutes = 0;

  if (timedSessions.length > 0) {
    for (const session of timedSessions) {
      const endTime = session.endTime || options.currentTime;
      const difference = diffInMinutes(session.startTime, endTime);
      if (difference === null) return null;
      // Rede de segurança: se uma sessão abranger uma atividade sem condução,
      // os minutos da atividade não entram na condução. As atividades são instantes
      // absolutos, por isso converte-se com o offset da própria sessão.
      const activityMinutes = calcActivityMinutesInRange(
        options.activities,
        session.startTime,
        endTime,
        session.utcOffset ?? options.utcOffset
      );
      totalMinutes += Math.max(0, difference - activityMinutes);
    }
  } else {
    const endTime = fallbackEnd || options.currentTime;
    if (!fallbackStart || !endTime) return null;
    const difference = diffInMinutes(fallbackStart, endTime);
    if (difference === null) return null;
    // Sem sessões registadas o tempo todo contaria como condução — desconta as atividades.
    const activityMinutes = calcActivityMinutesInRange(
      options.activities,
      fallbackStart,
      endTime,
      options.utcOffset
    );
    totalMinutes = Math.max(0, difference - activityMinutes);
  }

  const breakMinutes = Number.isFinite(options.breakMinutes) ? Math.max(0, options.breakMinutes ?? 0) : 0;
  return Math.max(0, totalMinutes - breakMinutes);
}

/**
 * Condução contínua desde a última pausa legal concluída (Reg. CE 561/2006, Art. 5º — 4h30).
 * `drivingMinutesAtLastBreak` é o total de condução no momento em que a última pausa
 * legal terminou; a base volta a zero apenas com pausa legal, nunca com atividade de serviço.
 */
export function calcContinuousDrivingMinutes(
  totalDrivingMinutes: number,
  drivingMinutesAtLastBreak?: number | null
): number {
  const baseline = Number.isFinite(drivingMinutesAtLastBreak)
    ? Math.max(0, drivingMinutesAtLastBreak ?? 0)
    : 0;
  return Math.max(0, totalDrivingMinutes - baseline);
}

/**
 * Total de minutos em atividades sem condução (carregamento, abastecimento, ...).
 * Atividade em curso é contada até `now`.
 */
export function calcWorkActivityMinutes(
  activities: Array<{ startedAt: string | Date; endedAt?: string | Date | null }> | null | undefined,
  now: Date = new Date()
): number {
  if (!activities || activities.length === 0) return 0;

  let total = 0;
  for (const activity of activities) {
    const start = new Date(activity.startedAt).getTime();
    if (Number.isNaN(start)) continue;
    const end = activity.endedAt ? new Date(activity.endedAt).getTime() : now.getTime();
    if (Number.isNaN(end)) continue;
    total += Math.max(0, end - start);
  }

  return Math.round(total / 60000);
}

export function calcHoursWorked(
  sessions: Array<{ startTime?: string | null; endTime?: string | null; status?: string }>,
  fallbackStart?: string | null,
  fallbackEnd?: string | null,
  options: TimeCalculationOptions = {}
): number | null {
  const totalMinutes = calcDrivingMinutes(sessions, fallbackStart, fallbackEnd, options);
  return totalMinutes === null ? null : parseFloat((totalMinutes / 60).toFixed(2));
}

/**
 * Calcula os KM percorridos com base nas sessões de condução.
 * Faz fallback para startKm/endKm do dia.
 */
export function calcKmTraveled(
  sessions: Array<{ startKm?: number | null; endKm?: number | null }>,
  fallbackStartKm?: number | null,
  fallbackEndKm?: number | null
): number | null {
  if (sessions.length > 0 && sessions.every(session => session.startKm != null && session.endKm != null)) {
    let total = 0;
    for (const session of sessions) {
      if (session.startKm == null || session.endKm == null || session.endKm < session.startKm) return null;
      total += session.endKm - session.startKm;
    }
    return total;
  }

  if (fallbackStartKm != null && fallbackEndKm != null) {
    if (fallbackEndKm >= fallbackStartKm) {
      return fallbackEndKm - fallbackStartKm;
    }
    return null;
  }

  return null;
}

/**
 * Formata minutos totais em string "H:MM".
 */
export function minutesToFormatted(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  return `${hours}:${mins.toString().padStart(2, '0')}`;
}

/**
 * Formata horas decimais (ex: 2.6) em string legível (ex: "2h36min").
 * Se os minutos forem 0, mostra apenas "Xh".
 */
export function formatDecimalHours(decimalHours: number | null | undefined): string {
  if (decimalHours == null || isNaN(decimalHours)) return '--';
  const totalMin = Math.round(decimalHours * 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (m === 0) return `${h}h`;
  return `${h}h${m.toString().padStart(2, '0')}min`;
}

export function getTimeAtUtcOffset(date: Date, utcOffset?: string | null): string {
  const match = /^([+-])(\d{2}):(\d{2})$/.exec(utcOffset || '');
  if (!match || Number(match[2]) > 14 || Number(match[3]) > 59) {
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  }

  const sign = match[1] === '+' ? 1 : -1;
  const offsetMinutes = sign * (Number(match[2]) * 60 + Number(match[3]));
  const offsetDate = new Date(date.getTime() + offsetMinutes * 60000);
  return `${String(offsetDate.getUTCHours()).padStart(2, '0')}:${String(offsetDate.getUTCMinutes()).padStart(2, '0')}`;
}

export function getTotalBreakMinutes(
  completedMinutes: number | null | undefined,
  activeBreakStart?: Date | string | null,
  now: Date = new Date()
): number {
  const completed = Number.isFinite(completedMinutes) ? Math.max(0, completedMinutes ?? 0) : 0;
  if (!activeBreakStart) return completed;

  const start = activeBreakStart instanceof Date ? activeBreakStart : new Date(activeBreakStart);
  if (Number.isNaN(start.getTime())) return completed;
  const activeMinutes = Math.max(0, Math.floor((now.getTime() - start.getTime()) / 60000));
  return completed + activeMinutes;
}

export function getRemainingBreakDebt(completedBreakMinutes: number | null | undefined): number {
  const completed = Number.isFinite(completedBreakMinutes) ? Math.max(0, completedBreakMinutes ?? 0) : 0;
  if (completed >= 45) return 45;
  if (completed >= 15) return 30;
  return 45;
}

export function resolveBreakCredit(
  elapsedMinutes: number,
  remainingDebtMinutes: number = 45
): {
  creditedMinutes: number;
  remainingDebtMinutes: number;
  resetContinuous: boolean;
} {
  const safeElapsed = Number.isFinite(elapsedMinutes) ? Math.max(0, elapsedMinutes) : 0;
  const debt = Number.isFinite(remainingDebtMinutes) ? Math.max(0, remainingDebtMinutes) : 45;
  const normalizedDebt = debt === 0 ? 45 : debt;

  if (normalizedDebt >= 45) {
    if (safeElapsed >= 45) return { creditedMinutes: 45, remainingDebtMinutes: 45, resetContinuous: true };
    if (safeElapsed >= 15) return { creditedMinutes: 15, remainingDebtMinutes: 30, resetContinuous: false };
    return { creditedMinutes: 0, remainingDebtMinutes: 45, resetContinuous: false };
  }

  if (normalizedDebt === 30) {
    if (safeElapsed >= 30) return { creditedMinutes: 30, remainingDebtMinutes: 45, resetContinuous: true };
    return { creditedMinutes: 0, remainingDebtMinutes: 30, resetContinuous: false };
  }

  return { creditedMinutes: 0, remainingDebtMinutes: normalizedDebt || 45, resetContinuous: false };
}

interface WorkDayDrivingTimeInput {
  startTime?: string | null;
  endTime?: string | null;
  utcOffset?: string | null;
  primaryDriverNumber?: number | null;
  breakMinutes?: number | null;
  breakStart?: Date | string | null;
  workActivities?: Array<{ startedAt: string | Date; endedAt?: string | Date | null }>;
  drivingSessions?: Array<{
    startTime?: string | null;
    endTime?: string | null;
    status?: string;
    driverNumber?: number | null;
    utcOffset?: string | null;
  }>;
}

export function calcWorkDayDrivingMinutes(
  workDay: WorkDayDrivingTimeInput,
  now: Date = new Date(),
  driverNumber: number | null = workDay.primaryDriverNumber ?? 1
): number | null {
  const sessions = (workDay.drivingSessions ?? []).filter(session =>
    driverNumber === null || (session.driverNumber ?? 1) === driverNumber
  );
  const activeSession = sessions.find(session => session.status === 'active' && !session.endTime);

  return calcDrivingMinutes(sessions, workDay.startTime, workDay.endTime, {
    currentTime: getTimeAtUtcOffset(now, activeSession?.utcOffset ?? workDay.utcOffset),
    breakMinutes: getTotalBreakMinutes(workDay.breakMinutes, workDay.breakStart, now),
    activities: workDay.workActivities,
    utcOffset: workDay.utcOffset,
  });
}

export function calcWorkDayHours(
  workDay: WorkDayDrivingTimeInput,
  now: Date = new Date(),
  driverNumber: number | null = workDay.primaryDriverNumber ?? 1
): number | null {
  const drivingMinutes = calcWorkDayDrivingMinutes(workDay, now, driverNumber);
  return drivingMinutes === null ? null : parseFloat((drivingMinutes / 60).toFixed(2));
}
