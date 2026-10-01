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

// ─── Limite de condução contínua de 4h30 (Reg. CE 561/2006, Art. 7) ──────────

/** Limite legal de condução contínua: 4h30 = 270 minutos */
export const MAX_CONTINUOUS_DRIVING_MINUTES = 270;
/** Pausa obrigatória mínima: 45 min contínuos OU 15 min + 30 min (total 45) */
export const REQUIRED_BREAK_MINUTES = 45;
export const SPLIT_BREAK_PHASE1_MINUTES = 15;
export const SPLIT_BREAK_PHASE2_MINUTES = 30;

/** Bloco de pausa com timestamps reais (persistido como JSON em WorkDay.breakBlocks) */
export interface BreakBlock {
  /** ISO string do início da pausa */
  start: string;
  /** ISO string do fim da pausa */
  end: string;
  /** Duração em minutos */
  minutes: number;
}

/** Plano de pausa necessário para cumprir o Art. 7 */
export interface RequiredBreakPlan {
  /** true se já existe uma pausa válida que renova o ciclo de condução */
  hasValidBreak: boolean;
  /** 'continuous' (45min), 'split' (15+30) ou null se ainda não há pausas */
  mode: 'continuous' | 'split' | null;
  /** Minutos válidos contabilizados desde a última pausa renovadora */
  validMinutes: number;
  /** Quantos minutos faltam para perfazer os 45 min obrigatórios (0 se cumprido) */
  remainingMinutes: number;
  /** true se os 45 minutos obrigatórios já foram cumpridos */
  isSatisfied: boolean;
}

/**
 * Converte um valor desconhecido (vindo do banco ou de JSON string) numa lista
 * de blocos de pausa válidos. Blocos inválidos (sem start/end ISO, com end < start,
 * com minutes <= 0 ou inconsistentes com os timestamps) são rejeitados.
 * Aceita: array já parseado, string JSON, ou null/undefined.
 */
export function parseStoredBreakBlocks(value: unknown): BreakBlock[] {
  let parsed: unknown = value;

  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return [];
    }
  }

  if (!Array.isArray(parsed)) return [];

  const blocks: BreakBlock[] = [];
  for (const item of parsed) {
    if (!item || typeof item !== 'object') continue;
    const candidate = item as Record<string, unknown>;
    if (typeof candidate.start !== 'string' || typeof candidate.end !== 'string') continue;

    const start = new Date(candidate.start);
    const end = new Date(candidate.end);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) continue;
    if (end.getTime() < start.getTime()) continue;

    const elapsedMinutes = Math.floor((end.getTime() - start.getTime()) / 60000);
    const rawMinutes = Number(candidate.minutes);
    const minutes = Number.isFinite(rawMinutes) && rawMinutes >= 0
      ? Math.min(Math.floor(rawMinutes), elapsedMinutes)
      : elapsedMinutes;
    if (minutes <= 0) continue;

    blocks.push({ start: start.toISOString(), end: end.toISOString(), minutes });
  }
  return blocks;
}

/**
 * Remove blocos duplicados (mesmo start+end). Mantém a primeira ocorrência e
 * ordena por data de início para garantir cálculos determinísticos.
 */
export function dedupeBreakBlocks(blocks: BreakBlock[]): BreakBlock[] {
  const seen = new Set<string>();
  const unique: BreakBlock[] = [];
  for (const block of blocks) {
    const key = `${block.start}|${block.end}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(block);
  }
  return unique.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
}

/**
 * Determina o plano de pausa obrigatório (45min contínuos OU 15+30 divididos)
 * a partir dos blocos de pausa registados.
 *
 * Regras (Reg. CE 561/2006, Art. 7):
 *  - Um bloco único >= 45 min é uma pausa contínua válida e renova o ciclo.
 *  - Dois blocos (>=15 min seguido de >=30 min) contam em conjunto (15+30=45).
 *  - Blocos inferiores a 15 min não contam isoladamente.
 *  - Uma pausa válida "renova" o contador: só os blocos posteriores contam.
 */
export function requiredBreakPlan(blocks: BreakBlock[]): RequiredBreakPlan {
  const sorted = dedupeBreakBlocks(blocks);

  // A pausa renovadora relevante é a MAIS RECENTE (renovação múltipla).
  //  1) Última pausa contínua válida (>= 45 min).
  //  2) Última combinação split: bloco >=15 min seguido de bloco >=30 min.
  let lastContinuousEnd: number | null = null;
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (sorted[i].minutes >= REQUIRED_BREAK_MINUTES) {
      lastContinuousEnd = new Date(sorted[i].end).getTime();
      break;
    }
  }

  let lastSplitEnd: number | null = null;
  for (let i = sorted.length - 1; i >= 1; i--) {
    const second = sorted[i];
    const first = sorted[i - 1];
    if (second.minutes >= SPLIT_BREAK_PHASE2_MINUTES && first.minutes >= SPLIT_BREAK_PHASE1_MINUTES) {
      lastSplitEnd = new Date(second.end).getTime();
      break;
    }
  }

  if (lastContinuousEnd !== null || lastSplitEnd !== null) {
    // Escolhe a renovação com término mais recente; em empate, a contínua.
    const mode: 'continuous' | 'split' =
      lastSplitEnd !== null && lastContinuousEnd !== null && lastSplitEnd > lastContinuousEnd
        ? 'split'
        : lastContinuousEnd !== null
          ? 'continuous'
          : 'split';
    return {
      hasValidBreak: true,
      mode,
      validMinutes: REQUIRED_BREAK_MINUTES,
      remainingMinutes: 0,
      isSatisfied: true,
    };
  }

  // 3) Nenhum plano completo ainda — acumula os blocos desde a última
  //    oportunidade de renovação (blocos >=15 min reiniciam a fase 1).
  let validMinutes = 0;
  for (const block of sorted) {
    if (block.minutes >= SPLIT_BREAK_PHASE1_MINUTES) {
      // Novo bloco elegível para fase 1: substitui tentativas anteriores.
      validMinutes = block.minutes;
    } else if (validMinutes >= SPLIT_BREAK_PHASE1_MINUTES && block.minutes >= SPLIT_BREAK_PHASE2_MINUTES) {
      validMinutes += block.minutes;
    } else if (validMinutes > 0) {
      validMinutes += block.minutes;
    }
  }

  const remaining = Math.max(0, REQUIRED_BREAK_MINUTES - validMinutes);
  return {
    hasValidBreak: validMinutes > 0,
    mode: validMinutes > 0 ? 'split' : null,
    validMinutes,
    remainingMinutes: remaining,
    isSatisfied: false,
  };
}

/**
 * Calcula os minutos de condução contínua desde a última pausa válida.
 *
 * @param sessions   Sessões de condução ({startTime, endTime} em "HH:MM", status)
 * @param dayDateStr Data do dia (ISO string ou "YYYY-MM-DD") — usada para construir
 *                   os Dates absolutos a partir das horas "HH:MM" no fuso dado.
 * @param utcOffset  Offset UTC do dia (ex: "+01:00"); fallback para UTC.
 * @param blocks     Blocos de pausa persistidos (breakBlocks)
 * @param now        Instante atual
 * @returns número de minutos de condução acumulados desde a última pausa válida
 *          (>= 45 min contínuos ou combinação 15+30). Se existir pausa válida,
 *          conta apenas o tempo conduzido após o FIM dessa pausa.
 */
export function continuousDrivingSinceLastValidBreak(
  sessions: Array<{ startTime?: string | null; endTime?: string | null; status?: string }>,
  dayDateStr: string | null | undefined,
  utcOffset: string | null | undefined,
  blocks: BreakBlock[],
  now: Date = new Date()
): number {
  const plan = requiredBreakPlan(blocks);

  // Determinar o instante de referência: fim da última pausa válida, ou null.
  let referenceEnd: number | null = null;
  const sorted = dedupeBreakBlocks(blocks);

  if (plan.mode === 'continuous') {
    for (let i = sorted.length - 1; i >= 0; i--) {
      if (sorted[i].minutes >= REQUIRED_BREAK_MINUTES) {
        referenceEnd = new Date(sorted[i].end).getTime();
        break;
      }
    }
  } else if (plan.mode === 'split' && plan.isSatisfied) {
    for (let i = sorted.length - 1; i >= 1; i--) {
      if (sorted[i].minutes >= SPLIT_BREAK_PHASE2_MINUTES && sorted[i - 1].minutes >= SPLIT_BREAK_PHASE1_MINUTES) {
        referenceEnd = new Date(sorted[i].end).getTime();
        break;
      }
    }
  }

  // Construir um Date absoluto a partir de "HH:MM" na data do dia, no fuso utcOffset.
  const toDate = (hhmm: string): Date | null => {
    const minutes = parseTimeToMinutes(hhmm);
    if (minutes === null) return null;

    let baseMs: number;
    if (dayDateStr) {
      const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(dayDateStr)
        ? dayDateStr
        : dayDateStr.slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) return null;
      // Meia-noite local (no fuso do dia) interpretada como UTC…
      baseMs = new Date(`${dateOnly}T00:00:00.000Z`).getTime();
    } else {
      const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
      baseMs = today.getTime();
    }

    // …a hora local "HH:MM" corresponde a esse instante MENOS o offset UTC.
    // Ex: offset +01:00 → "08:00" local = 07:00 UTC.
    const match = /^([+-])(\d{2}):(\d{2})$/.exec(utcOffset || '');
    const offsetMinutes = match
      ? (match[1] === '+' ? 1 : -1) * (Number(match[2]) * 60 + Number(match[3]))
      : 0;
    return new Date(baseMs + minutes * 60000 - offsetMinutes * 60000);
  };

  let total = 0;
  for (const session of sessions) {
    if (!session.startTime) continue;
    const start = toDate(session.startTime);
    if (!start) continue;

    let end: Date | null;
    if (session.endTime) {
      end = toDate(session.endTime);
      if (end && end.getTime() < start.getTime()) {
        // Passagem de meia-noite: sessão terminou no dia seguinte.
        end = new Date(end.getTime() + 24 * 60 * 60000);
      }
    } else if (session.status === 'active') {
      end = now;
    } else {
      continue;
    }
    if (!end) continue;

    let startMs = start.getTime();
    let endMs = Math.min(end.getTime(), now.getTime());
    if (endMs <= startMs) continue;

    if (referenceEnd !== null) {
      // Contar apenas o conduzo APÓS a última pausa válida.
      if (endMs <= referenceEnd) continue;
      startMs = Math.max(startMs, referenceEnd);
    }
    total += Math.floor((endMs - startMs) / 60000);
  }

  return Math.max(0, total);
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
