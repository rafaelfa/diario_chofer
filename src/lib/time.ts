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
/**
 * ─── Pausa inteligente (Reg. CE 561/2006, Art. 7) ───────────────────────────
 * Um único botão "PAUSA". O sistema só contabiliza pausas válidas:
 *   • 45 min contínuos, OU
 *   • 15 min + 30 min (em dois blocos separados).
 * Qualquer bloco fora dessas regras NÃO conta como pausa:
 *   - Bloco ≥45 → pausa contínua cumprida (zera tudo).
 *   - Bloco entre 15 e 44 → conta como 1ª fase; fica a faltar um bloco
 *     contínuo de 30 min (mostra "faltam 30 min" no botão).
 *   - Bloco <15 (ex.: 29 ou 27 min quando ainda não há fase 1) → não conta.
 *   - Após a fase de 15, bloco ≥30 → pausa dividida cumprida.
 *   - Após a fase de 15, bloco <30 (ex.: 27) → não conta (mantém "faltam 30").
 */
export type BreakPhase = 'none' | 'awaiting15' | 'awaiting30' | 'done';

export interface BreakStateInfo {
  phase: BreakPhase;
  /** Minutos que ainda faltam para cumprir a pausa obrigatória (0 se done) */
  remainingRequiredMinutes: number;
}

export function computeBreakPhase(elapsedMinutes: number, hadPhase15: boolean): BreakStateInfo {
  const m = Math.max(0, Math.floor(elapsedMinutes));
  if (hadPhase15) {
    // Segunda fase em curso: precisa de 30 min contínuos
    return m >= 30
      ? { phase: 'done', remainingRequiredMinutes: 0 }
      : { phase: 'awaiting30', remainingRequiredMinutes: 30 };
  }
  if (m >= 45) return { phase: 'done', remainingRequiredMinutes: 0 };
  if (m >= 15) return { phase: 'awaiting30', remainingRequiredMinutes: 30 };
  return { phase: 'awaiting15', remainingRequiredMinutes: 45 };
}

/**
 * Tempo total de pausa que deve ser DESCONTADO da condução até agora.
 * Regra do botão único: cada BLOCO conta apenas pelo bloco completo mais baixo:
 *   - <15 min → 0 (não conta);
 *   - 15–44 min → 15 (fase 1);
 *   - ≥45 min → 45 (pausa contínua).
 * Na fase 2 (após a fase 1), só um bloco contínuo ≥30 conta (+30).
 */
export function creditedBreakMinutes(elapsedMinutes: number, hadPhase15: boolean): number {
  const m = Math.max(0, Math.floor(elapsedMinutes));
  if (hadPhase15) return m >= 30 ? 45 : 15;
  if (m >= 45) return 45;
  if (m >= 15) return 15;
  return 0;
}

/** Minutos de pausa concluídos e válidos ganhos ao terminar um bloco. */
export function gainedBreakMinutes(elapsedMinutes: number, hadPhase15: boolean): number {
  const m = Math.max(0, Math.floor(elapsedMinutes));
  if (!hadPhase15) {
    if (m >= 45) return 45;
    if (m >= 15) return 15;
    return 0;
  }
  return m >= 30 ? 30 : 0;
}

/**
 * Blocos de pausa CONCLUÍDOS e VÁLIDOS num dia (Reg. CE 561/2006, Art. 7).
 * Cada bloco conta pelo nível completo mais baixo:
 *   - ≥45 min contínuos → um bloco de 45;
 *   - fase 1 (15–44 min) + fase 2 (≥30 min contínuos) → dois blocos (15 + 30);
 *   - blocos fora destas regras não contam.
 */
export interface CompletedBreakBlock {
  start: Date;
  end: Date;
  minutes: 15 | 30 | 45;
}

/** Ordena blocos por início e remove sobreposições (mantém o primeiro). */
export function dedupeBreakBlocks(blocks: CompletedBreakBlock[]): CompletedBreakBlock[] {
  const sorted = [...blocks].sort((a, b) => a.start.getTime() - b.start.getTime());
  const result: CompletedBreakBlock[] = [];
  for (const block of sorted) {
    const prev = result[result.length - 1];
    if (prev && block.start < prev.end) continue; // sobreposto — descarta
    result.push(block);
  }
  return result;
}

/**
 * Condução CONTÍNUA desde a última pausa válida (Art. 7: máx. 4h30).
 * Percorre cronologicamente sessões de condução e blocos de pausa válidos;
 * cada pausa válida RENOVA o contador dos 4h30. Retorna os minutos do
 * segmento de condução em curso (0 se ainda não conduziu ou se está em pausa).
 */
export function continuousDrivingSinceLastValidBreak(
  sessions: Array<{ startTime?: string | null; endTime?: string | null }>,
  blocks: CompletedBreakBlock[],
  now: Date = new Date()
): number {
  type Item = { start: Date; end: Date; isBreak: boolean };
  const items: Item[] = [
    ...dedupeBreakBlocks(blocks).map(b => ({ start: b.start, end: b.end, isBreak: true })),
    ...sessions
      .filter(s => s.startTime)
      .map(s => {
        const start = new Date(s.startTime as string);
        const end = s.endTime ? new Date(s.endTime) : now;
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
        return { start, end: end > start ? end : start, isBreak: false };
      })
      .filter((x): x is Item => x !== null),
  ];
  items.sort((a, b) => a.start.getTime() - b.start.getTime());

  let sinceMs = 0;
  let inBreak = false;
  for (const item of items) {
    if (item.isBreak) {
      sinceMs = 0; // pausa válida renova os 4h30
      inBreak = item.end > now && item.start <= now;
    } else {
      if (inBreak && item.end <= item.start) continue;
      // se a sessão começa durante uma pausa, o tempo conta a partir do fim da pausa
      const effectiveStart = inBreak && item.start < item.end ? item.end : item.start;
      if (effectiveStart >= now) break;
      sinceMs += Math.max(0, Math.min(item.end.getTime(), now.getTime()) - effectiveStart.getTime());
      if (item.end >= now) break;
    }
  }
  return Math.floor(sinceMs / 60000);
}

/** Próximos passos da pausa obrigatória com base na condução contínua atual. */
export function requiredBreakPlan(continuousMinutes: number): {
  drivingBeforeBreakMin: number; // limite legal (270 = 4h30)
  remainingUntilMustPauseMin: number; // quanto falta para ser OBRIGATÓRIO parar
  remainingRequiredBreakMin: number; // minutos de pausa necessários agora (45 ou 15)
} {
  const remaining = Math.max(0, 270 - continuousMinutes);
  return {
    drivingBeforeBreakMin: 270,
    remainingUntilMustPauseMin: remaining,
    remainingRequiredBreakMin: remaining <= 135 ? 15 : 45,
  };
}

/**
 * Estado persistido após TERMINAR um bloco de pausa.
 *  - Bloco ≥45 sem fase 1 → pausa cumprida (zera tudo).
 *  - Bloco 15–44 sem fase 1 → fase 1 ganha, exige bloco contínuo ≥30.
 *  - Bloco ≥30 com fase 1 → pausa dividida cumprida (zera tudo).
 *  - Bloco <15 (sem fase 1) ou <30 (com fase 1) → NÃO contabiliza nada;
 *    mantém o estado anterior (fase 1 continua por cumprir se existia).
 */
export function nextBreakState(
  elapsedMinutes: number,
  hadPhase15: boolean
): { hadPhase15: boolean; completedBreakMinutes: number; fullyDone: boolean } {
  const m = Math.max(0, Math.floor(elapsedMinutes));
  if (hadPhase15) {
    return m >= 30
      ? { hadPhase15: false, completedBreakMinutes: 45, fullyDone: true }
      : { hadPhase15: true, completedBreakMinutes: 0, fullyDone: false };
  }
  if (m >= 45) return { hadPhase15: false, completedBreakMinutes: 45, fullyDone: true };
  if (m >= 15) return { hadPhase15: true, completedBreakMinutes: 15, fullyDone: false };
  return { hadPhase15: false, completedBreakMinutes: 0, fullyDone: false };
}

/** Rótulo do estado actual para mostrar no botão de pausa. */
export function breakButtonLabel(info: BreakStateInfo): string {
  switch (info.phase) {
    case 'done': return 'Pausa cumprida ✓';
    case 'awaiting30': return 'Faltam 30 min';
    default: return 'Pausa';
  }
}

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
