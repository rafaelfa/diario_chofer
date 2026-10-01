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

/** @deprecated Usar getValidBreakMinutes — blocos <15m não contam para a pausa obrigatória. */
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

// ─── Pausas flexíveis — Reg. CE 561/2006, Art. 4º (regra 45m ou 15m + 30m) ───

/** Duração mínima legal de um bloco de pausa fracionado (1ª parte). */
export const BREAK_BLOCK_MIN_FIRST = 15;
/** Duração mínima legal do segundo bloco quando o primeiro ainda não fechou os 45m. */
export const BREAK_BLOCK_MIN_SECOND = 30;
/** Duração da pausa única completa. */
export const BREAK_REQUIRED_TOTAL = 45;

/**
 * Um bloco de pausa registado (duração real medida entre clique em "Pausa" e "Retomar").
 * `start`/`end` são timestamps ISO para permitir restauro após refresh.
 */
export interface BreakBlock {
  start: string;
  end: string;
  minutes: number;
}

/** Resultado da avaliação dos blocos de pausa face à regra 45m / 15m+30m. */
export interface BreakStatus {
  /** Soma dos minutos LEGALMENTE válidos (blocos ≥15m; nunca conta blocos <15m) */
  validMinutes: number;
  /** Minutos que faltam para cumprir a pausa obrigatória */
  remainingMinutes: number;
  /** true quando a obrigação está cumprida (45m contínuos ou 15m + 30m) */
  isComplete: boolean;
  /** true se existe um bloco único com ≥45 minutos */
  hasContinuous45: boolean;
  /** true se o bloco de ≥15m (1ª parte) já foi feito */
  hasFirstBlock: boolean;
  /** true se o bloco de ≥30m (2ª parte) já foi feito */
  hasSecondBlock: boolean;
  /** Bloco em curso (não fechado) — minutos reais até agora */
  activeMinutes: number;
  /** Quantos minutos faltam para o bloco em curso fechar (0 se já fechou) */
  activeRemaining: number;
  /** Rótulo legível do estado ("45 min contínuos", "Faltam 30 min", ...) */
  label: string;
}

/**
 * Motor de cálculo da regra de pausas flexíveis.
 *
 * Regras estritas:
 *  - Pausa válida = bloco único de ≥45min OU dois blocos: 1º ≥15min + 2º ≥30min.
 *  - Blocos com menos de 15 minutos NÃO contabilizam para a pausa obrigatória.
 *  - Exemplo: bloco de 16min → conta como bloco válido de 15m, faltam 30m.
 *  - Exemplo: bloco de 29min (<45m, ≥15m) → conta só como os 15m, faltam 30m.
 *  - Exemplo: 15m já feitos + bloco de 27min → os 27m não fecham o 2º bloco
 *    (precisam de ≥30m), logo continuam a faltar 30m.
 */
export function evaluateBreakBlocks(
  blocks: BreakBlock[] | null | undefined,
  activeStart?: Date | string | null,
  now: Date = new Date()
): BreakStatus {
  const list = Array.isArray(blocks) ? blocks : [];

  let hasContinuous45 = false;
  let hasFirstBlock = false;
  let hasSecondBlock = false;

  for (const block of list) {
    const minutes = Number(block?.minutes);
    if (!Number.isFinite(minutes) || minutes < BREAK_BLOCK_MIN_FIRST) continue; // <15m descartado
    if (minutes >= BREAK_REQUIRED_TOTAL) hasContinuous45 = true;
    else hasFirstBlock = true;
  }

  if (!hasContinuous45 && hasFirstBlock) {
    // O 2º bloco tem de ter ≥30min; blocos de 15–29min repetem apenas a 1ª parte.
    hasSecondBlock = list.some(block => {
      const minutes = Number(block?.minutes);
      return Number.isFinite(minutes) && minutes >= BREAK_REQUIRED_TOTAL - BREAK_BLOCK_MIN_FIRST && minutes < BREAK_REQUIRED_TOTAL;
    });
  }

  const isComplete = hasContinuous45 || (hasFirstBlock && hasSecondBlock);

  let validMinutes = 0;
  if (hasContinuous45) validMinutes = BREAK_REQUIRED_TOTAL;
  else if (hasFirstBlock) validMinutes = hasSecondBlock ? BREAK_REQUIRED_TOTAL : BREAK_BLOCK_MIN_FIRST;

  const remainingMinutes = isComplete ? 0 : BREAK_REQUIRED_TOTAL - validMinutes;

  // Bloco em curso (pausa iniciada mas ainda não retomada)
  let activeMinutes = 0;
  if (activeStart) {
    const start = activeStart instanceof Date ? activeStart : new Date(activeStart);
    if (!Number.isNaN(start.getTime())) {
      activeMinutes = Math.max(0, Math.floor((now.getTime() - start.getTime()) / 60000));
    }
  }

  let activeRemaining = 0;
  if (activeMinutes > 0 && !isComplete) {
    if (!hasFirstBlock) {
      // Ainda sem 1ª parte: o bloco em curso fecha aos 15m (ou aos 45m se for contínuo)
      activeRemaining = Math.max(0, Math.min(BREAK_BLOCK_MIN_FIRST, BREAK_REQUIRED_TOTAL) - activeMinutes);
    } else {
      // Com a 1ª parte feita, o bloco em curso só fecha aos 30m (ou 45m se continuar)
      activeRemaining = Math.max(0, Math.min(BREAK_BLOCK_MIN_SECOND, BREAK_REQUIRED_TOTAL) - activeMinutes);
    }
  }

  let label: string;
  if (isComplete) {
    label = hasContinuous45 ? 'Pausa de 45 min contínuos cumprida' : 'Pausa 15 min + 30 min cumprida';
  } else if (hasFirstBlock) {
    label = `Faltam ${BREAK_BLOCK_MIN_SECOND} minutos de pausa`;
  } else if (activeMinutes > 0) {
    label = `Em pausa — faltam ${activeRemaining} min para fechar o bloco de ${BREAK_BLOCK_MIN_FIRST} min`;
  } else {
    label = `Faltam ${BREAK_REQUIRED_TOTAL} minutos de pausa`;
  }

  return {
    validMinutes,
    remainingMinutes,
    isComplete,
    hasContinuous45,
    hasFirstBlock,
    hasSecondBlock,
    activeMinutes,
    activeRemaining,
    label,
  };
}

/**
 * Total de minutos de pausa VALIDOS (regra 45m / 15m+30m) a subtrair do tempo de condução.
 * Inclui o progresso do bloco em curso quando este já atinge os mínimos legais.
 */
export function getValidBreakMinutes(
  blocks: BreakBlock[] | null | undefined,
  activeStart?: Date | string | null,
  now: Date = new Date()
): number {
  const status = evaluateBreakBlocks(blocks, activeStart, now);
  let total = status.validMinutes;

  const list = Array.isArray(blocks) ? blocks : [];
  const hasOpenBlock = list.some(block => typeof block?.end !== 'string' || !block.end);

  if (status.activeMinutes > 0 && !status.isComplete && !hasOpenBlock) {
    if (!status.hasFirstBlock && status.activeMinutes >= BREAK_BLOCK_MIN_FIRST) {
      total += Math.min(status.activeMinutes, BREAK_REQUIRED_TOTAL);
    } else if (status.hasFirstBlock && status.activeMinutes >= BREAK_BLOCK_MIN_SECOND) {
      total += Math.min(status.activeMinutes, BREAK_REQUIRED_TOTAL);
    }
  }

  return total;
}

/** Converte um valor qualquer (JSON de API) num array de blocos válido. */
export function normalizeBreakBlocks(value: unknown): BreakBlock[] {
  if (!Array.isArray(value)) return [];
  const result: BreakBlock[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const { start, end, minutes } = item as Record<string, unknown>;
    if (typeof start !== 'string' || typeof minutes !== 'number' || !Number.isFinite(minutes)) continue;
    result.push({ start, end: typeof end === 'string' ? end : '', minutes });
  }
  return result;
}

/** Constrói um bloco a partir do início/fim reais da pausa (duração em minutos completos). */
export function buildBreakBlock(start: Date, end: Date = new Date()): BreakBlock {
  const minutes = Math.max(0, Math.floor((end.getTime() - start.getTime()) / 60000));
  return { start: start.toISOString(), end: end.toISOString(), minutes };
}

export function calcWorkDayHours(
  workDay: {
    startTime?: string | null;
    endTime?: string | null;
    utcOffset?: string | null;
    primaryDriverNumber?: number | null;
    /** @deprecated Campo legado — usado apenas como fallback se não existirem breakBlocks */
    breakMinutes?: number | null;
    breakStart?: Date | string | null;
    /** Blocos de pausa medidos (regra 45m / 15m+30m). Fonte primária de cálculo. */
    breakBlocks?: BreakBlock[] | unknown;
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

  const blocks = normalizeBreakBlocks(workDay.breakBlocks);
  const breakMinutes = blocks.length > 0
    ? getValidBreakMinutes(blocks, workDay.breakStart, now)
    : getTotalBreakMinutes(workDay.breakMinutes, workDay.breakStart, now);

  return calcHoursWorked(sessions, workDay.startTime, workDay.endTime, {
    currentTime: getTimeAtUtcOffset(now, activeSession?.utcOffset ?? workDay.utcOffset),
    breakMinutes,
  });
}
