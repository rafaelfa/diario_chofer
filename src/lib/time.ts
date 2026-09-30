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
}

export function calcDrivingMinutes(
  sessions: Array<{ startTime?: string | null; endTime?: string | null; status?: string }>,
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
      totalMinutes += difference;
    }
  } else {
    const endTime = fallbackEnd || options.currentTime;
    if (!fallbackStart || !endTime) return null;
    const difference = diffInMinutes(fallbackStart, endTime);
    if (difference === null) return null;
    totalMinutes = difference;
  }

  const breakMinutes = Number.isFinite(options.breakMinutes) ? Math.max(0, options.breakMinutes ?? 0) : 0;
  return Math.max(0, totalMinutes - breakMinutes);
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

// ─── Condução contínua e renovação dos 4h30 (Reg. CE 561/2006, Art. 7) ──────

/** Bloco de pausa concluído com timestamps reais (persistido como JSON no WorkDay) */
export interface StoredBreakBlock {
  /** ISO string do início da pausa */
  start: string;
  /** ISO string do fim da pausa */
  end: string;
  minutes: number;
}

/** Sessão de condução com datas absolutas (para cálculo de condução contínua) */
export interface AbsoluteDrivingSession {
  start: Date;
  end: Date | null; // null = sessão ainda em curso
}

/**
 * Faz parse seguro do campo JSON `breakBlocks` (string ou array) vindo do banco.
 * Descarta blocos inválidos, ordena por data e deduplica entradas idênticas.
 */
export function parseStoredBreakBlocks(raw: unknown): StoredBreakBlock[] {
  let value = raw;
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(value)) return [];

  const blocks: StoredBreakBlock[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const start = (item as { start?: unknown }).start;
    const end = (item as { end?: unknown }).end;
    const minutes = (item as { minutes?: unknown }).minutes;
    if (typeof start !== 'string' || typeof end !== 'string') continue;
    const startDate = new Date(start);
    const endDate = new Date(end);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) continue;
    if (endDate.getTime() < startDate.getTime()) continue;
    if (typeof minutes !== 'number' || !Number.isFinite(minutes) || minutes <= 0) continue;
    blocks.push({ start: startDate.toISOString(), end: endDate.toISOString(), minutes });
  }

  blocks.sort((a, b) => a.start.localeCompare(b.start));
  return dedupeBreakBlocks(blocks);
}

/** Remove blocos duplicados (mesmo start/end/minutes) mantendo a ordem. */
export function dedupeBreakBlocks(blocks: StoredBreakBlock[]): StoredBreakBlock[] {
  const seen = new Set<string>();
  const result: StoredBreakBlock[] = [];
  for (const block of blocks) {
    const key = `${block.start}|${block.end}|${block.minutes}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(block);
  }
  return result;
}

/** Pausa válida para renovar as 4h30: ≥45min contínuos OU par 15+30 dentro de ≤75min. */
function isValidRenewalBlockPair(a: StoredBreakBlock, b: StoredBreakBlock): boolean {
  const first = a.minutes >= 15 && a.minutes < 30 ? a : b.minutes >= 15 && b.minutes < 30 ? b : null;
  const second = first === a ? b : a;
  if (!first || !second) return false;
  if (!(second.minutes >= 30)) return false;
  const gapMinutes = (new Date(second.start).getTime() - new Date(first.end).getTime()) / 60000;
  return gapMinutes >= 0 && gapMinutes <= 75;
}

/**
 * Calcula quantos minutos de CONDUÇÃO CONTÍNUA decorreram desde a última pausa
 * VÁLIDA (45min contínuos, ou 15+30 conforme Reg. 561/2006 Art. 4(2)(b)/7).
 * Blocos inválidos (<45 e não integrando um par 15+30) NÃO renovam o período —
 * os minutos de condução acumulam-se através deles.
 * Se `now` for fornecido, uma sessão ativa (end=null) é considerada até `now`.
 */
export function continuousDrivingSinceLastValidBreak(
  sessions: AbsoluteDrivingSession[],
  blocks: StoredBreakBlock[],
  now: Date = new Date()
): number {
  const valid = [...blocks].sort((a, b) => a.start.localeCompare(b.start));

  // Marcadores temporais que renovam o contador de condução contínua
  const resetPoints: number[] = [];
  for (let i = 0; i < valid.length; i++) {
    const block = valid[i];
    if (block.minutes >= 45) {
      resetPoints.push(new Date(block.end).getTime());
      continue;
    }
    // tenta formar par 15+30 com o bloco seguinte
    if (i + 1 < valid.length && isValidRenewalBlockPair(block, valid[i + 1])) {
      resetPoints.push(new Date(valid[i + 1].end).getTime());
      i++; // consome o segundo bloco do par
    }
  }
  resetPoints.sort((a, b) => a - b);

  const lastReset = resetPoints.length > 0 ? resetPoints[resetPoints.length - 1] : null;

  let totalMs = 0;
  for (const session of sessions) {
    const startMs = session.start.getTime();
    const endMs = Math.min(session.end ? session.end.getTime() : Infinity, now.getTime());
    if (!Number.isFinite(startMs) || endMs <= startMs) continue;
    const from = lastReset !== null ? Math.max(startMs, lastReset) : startMs;
    if (endMs > from) totalMs += endMs - from;
  }
  return Math.floor(totalMs / 60000);
}

/** Plano de pausa obrigatória necessário para renovar as 4h30. */
export interface BreakPlan {
  /** Opção A: pausa contínua de 45 minutos */
  continuousMinutes: 45;
  /** Opção B: 15 min + 30 min */
  splitFirstMinutes: 15;
  splitSecondMinutes: 30;
}

/**
 * Dados do contador de condução contínua (limite legal: 4h30 = 270 min).
 */
export const MAX_CONTINUOUS_DRIVING_MINUTES = 270;

export interface ContinuousDrivingInfo {
  /** Minutos de condução contínua desde a última pausa válida */
  continuousMinutes: number;
  /** Minutos que faltam para atingir as 4h30 (0 se já atingido/ultrapassado) */
  remainingMinutes: number;
  /** Limite legal em minutos (270) */
  limitMinutes: number;
  /** true se ultrapassou as 4h30 sem pausa válida */
  exceeded: boolean;
  /** true se falta ≤30 min para o limite (aviso antecipado) */
  warning: boolean;
  /** true se há pausa em curso no momento da avaliação */
  onBreak: boolean;
  breakPlan: BreakPlan;
}

/**
 * Combina sessões "HH:MM" de um dia (com utcOffset) em datas absolutas.
 * `dayDate` é a data da jornada ("YYYY-MM-DD" ou Date serializado).
 */
export function buildAbsoluteSessions(
  dayDate: string | Date,
  sessions: Array<{ startTime?: string | null; endTime?: string | null; utcOffset?: string | null }>,
  dayUtcOffset?: string | null
): AbsoluteDrivingSession[] {
  const dateStr = typeof dayDate === 'string'
    ? (/^\d{4}-\d{2}-\d{2}$/.test(dayDate.slice(0, 10)) ? dayDate.slice(0, 10) : null)
    : null;
  // Data base UTC à meia-noite do dia (sem offset) — suficiente para diferenciar momentos
  const baseUtc = dateStr
    ? Date.parse(`${dateStr}T00:00:00.000Z`)
    : new Date(dayDate).setUTCHours(0, 0, 0, 0);
  if (Number.isNaN(baseUtc)) return [];

  const toAbsolute = (time: string, offset?: string | null): number | null => {
    const minutes = parseTimeToMinutes(time);
    if (minutes === null) return null;
    const match = /^([+-])(\d{2}):(\d{2})$/.exec(offset || dayUtcOffset || '');
    let offsetMinutes = 0;
    if (match && Number(match[2]) <= 14 && Number(match[3]) <= 59) {
      offsetMinutes = (match[1] === '+' ? 1 : -1) * (Number(match[2]) * 60 + Number(match[3]));
    }
    const ms = baseUtc + minutes * 60000 - offsetMinutes * 60000;
    // passagem de meia-noite: sessão que termina "antes" de ter começado ⇒ dia seguinte
    return ms;
  };

  const result: AbsoluteDrivingSession[] = [];
  let previousStartMs: number | null = null;
  for (const session of sessions) {
    if (!session.startTime) continue;
    let startMs = toAbsolute(session.startTime, session.utcOffset);
    if (startMs === null) continue;
    if (previousStartMs !== null && startMs < previousStartMs) startMs += 24 * 60 * 60000;
    previousStartMs = startMs;
    let endMs = session.endTime ? toAbsolute(session.endTime, session.utcOffset) : null;
    if (endMs !== null && endMs < startMs) endMs += 24 * 60 * 60 * 1000;
    result.push({ start: new Date(startMs), end: endMs !== null ? new Date(endMs) : null });
  }
  return result;
}

/**
 * Info completa do contador de condução contínua para exibição na UI.
 */
export function getContinuousDrivingInfo(
  workDay: {
    date: string | Date;
    utcOffset?: string | null;
    breakBlocks?: unknown;
    drivingSessions?: Array<{
      startTime?: string | null;
      endTime?: string | null;
      status?: string;
      driverNumber?: number | null;
      utcOffset?: string | null;
    }>;
  },
  options: { now?: Date; activeBreakStart?: Date | string | null } = {}
): ContinuousDrivingInfo {
  const now = options.now ?? new Date();
  const sessions = buildAbsoluteSessions(
    workDay.date,
    (workDay.drivingSessions ?? []).filter(s => (s.driverNumber ?? 1) === 1),
    workDay.utcOffset
  );
  const blocks = parseStoredBreakBlocks(workDay.breakBlocks);
  const continuousMinutes = continuousDrivingSinceLastValidBreak(sessions, blocks, now);
  const remainingMinutes = Math.max(0, MAX_CONTINUOUS_DRIVING_MINUTES - continuousMinutes);

  let onBreak = false;
  if (options.activeBreakStart) {
    const start = options.activeBreakStart instanceof Date
      ? options.activeBreakStart
      : new Date(options.activeBreakStart);
    onBreak = !Number.isNaN(start.getTime()) && start.getTime() <= now.getTime();
  }

  return {
    continuousMinutes,
    remainingMinutes,
    limitMinutes: MAX_CONTINUOUS_DRIVING_MINUTES,
    exceeded: continuousMinutes > MAX_CONTINUOUS_DRIVING_MINUTES,
    warning: !onBreak && remainingMinutes <= 30,
    onBreak,
    breakPlan: { continuousMinutes: 45, splitFirstMinutes: 15, splitSecondMinutes: 30 },
  };
}

export function calcWorkDayHours(
  workDay: {
    startTime?: string | null;
    endTime?: string | null;
    utcOffset?: string | null;
    primaryDriverNumber?: number | null;
    breakMinutes?: number | null;
    breakStart?: Date | string | null;
    drivingSessions?: Array<{
      startTime?: string | null;
      endTime?: string | null;
      status?: string;
      driverNumber?: number | null;
      utcOffset?: string | null;
    }>;
  },
  now: Date = new Date(),
  driverNumber: number | null = workDay.primaryDriverNumber ?? 1
): number | null {
  const sessions = (workDay.drivingSessions ?? []).filter(session =>
    driverNumber === null || (session.driverNumber ?? 1) === driverNumber
  );
  const activeSession = sessions.find(session => session.status === 'active' && !session.endTime);

  return calcHoursWorked(sessions, workDay.startTime, workDay.endTime, {
    currentTime: getTimeAtUtcOffset(now, activeSession?.utcOffset ?? workDay.utcOffset),
    breakMinutes: getTotalBreakMinutes(workDay.breakMinutes, workDay.breakStart, now),
  });
}
