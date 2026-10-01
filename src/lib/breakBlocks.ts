/**
 * Motor de cálculo de blocos de pausa — Reg. CE 561/2006, Art. 7º
 *
 * Regra estrita de validação:
 *   - Pausa contínua ≥ 45 min; OU
 *   - Divisão em dois blocos: 1º bloco ≥ 15 min e 2º bloco ≥ 30 min.
 *
 * Blocos fora destas medidas não contam como pausa obrigatória
 * (são descartados na avaliação de conformidade).
 */

export const BREAK_CONTINUOUS_MIN = 45;
export const BREAK_SPLIT_1_MIN = 15;
export const BREAK_SPLIT_2_MIN = 30;

/** Máximo de condução contínua permitido entre pausas obrigatórias (4h30). */
export const MAX_CONTINUOUS_DRIVING_MIN = 270;

export interface BreakBlock {
  /** Início do bloco (ms epoch) */
  startMs: number;
  /** Fim do bloco (ms epoch); se ainda em curso, usar Date.now() */
  endMs: number;
}

export interface BreakValidation {
  /** Total de minutos conducentes a pausa obrigatória (blocos ≥15m, ignorando <15m) */
  validMinutes: number;
  /** Os blocos aceites pela regra estrita */
  acceptedBlocks: BreakBlock[];
  /** Blocos descartados (< 15 min não contam para a pausa obrigatória) */
  discardedBlocks: BreakBlock[];
  /** A obrigação de pausa de 45 min está cumprida? */
  satisfied: boolean;
}

/** Duração de um bloco em minutos (arredondado para baixo). */
export function blockDurationMin(block: BreakBlock, nowMs?: number): number {
  const end = Math.min(block.endMs, nowMs ?? Number.POSITIVE_INFINITY);
  return Math.max(0, Math.floor((end - block.startMs) / 60000));
}

/**
 * Valida blocos de pausa contra a regra estrita do Art. 7º.
 * Blocos com menos de 15 min são descartados; blocos ≥15 min contam,
 * até perfazer os 45 min exigidos (contínuos ou 15 + 30).
 */
export function validateBreakBlocks(blocks: BreakBlock[], nowMs?: number): BreakValidation {
  const sorted = [...blocks].sort((a, b) => a.startMs - b.startMs);
  const acceptedBlocks: BreakBlock[] = [];
  const discardedBlocks: BreakBlock[] = [];
  let validMinutes = 0;

  for (const block of sorted) {
    const duration = blockDurationMin(block, nowMs);
    if (duration < BREAK_SPLIT_1_MIN) {
      discardedBlocks.push(block);
      continue; // Bloco fora das medidas legais → descartado
    }
    acceptedBlocks.push(block);
    validMinutes += duration;
  }

  const satisfied = validMinutes >= BREAK_CONTINUOUS_MIN;
  return { validMinutes, acceptedBlocks, discardedBlocks, satisfied };
}

/** Tempo que ainda falta cumprir da pausa obrigatória (0 se já cumprida). */
export function breakRemainingMinutes(validMinutes: number): number {
  return Math.max(0, BREAK_CONTINUOUS_MIN - validMinutes);
}

export type BreakPlanStep = 'A' | 'B';

export interface BreakPlan {
  /** Próximo passo recomendado */
  nextStep: BreakPlanStep;
  /** Minutos necessários no próximo passo */
  stepMinutes: number;
  /** Plano total recomendado */
  strategy: 'continuous-45' | 'split-15-30';
}

/**
 * Plano dinâmico de pausa com base nos minutos já acumulados em blocos válidos.
 *
 * - Nada cumprido → recomenda 45 min contínuos (ou dividir 15 + 30).
 * - 1º bloco de 15 min cumprido → faltam 30 min (passo B da divisão).
 * - Entre 15 e 45 min → falta o restante para atingir os 45 min.
 * - ≥ 45 min → pausa obrigatória cumprida.
 */
export function computeBreakPlan(validMinutes: number): BreakPlan {
  const remaining = breakRemainingMinutes(validMinutes);

  if (remaining <= 0) {
    return { nextStep: 'B', stepMinutes: 0, strategy: 'continuous-45' };
  }
  if (validMinutes === 0) {
    return { nextStep: 'A', stepMinutes: BREAK_CONTINUOUS_MIN, strategy: 'continuous-45' };
  }
  if (validMinutes < BREAK_SPLIT_1_MIN) {
    // Bloco parcial abaixo do mínimo legal — precisa de 15 min completos
    return { nextStep: 'A', stepMinutes: BREAK_SPLIT_1_MIN, strategy: 'split-15-30' };
  }
  if (validMinutes < BREAK_CONTINUOUS_MIN) {
    // Ex.: 15 min feitos → faltam 30 (passo B); 30 feitos → faltam 15
    return { nextStep: 'B', stepMinutes: remaining, strategy: 'split-15-30' };
  }
  return { nextStep: 'B', stepMinutes: 0, strategy: 'continuous-45' };
}

/**
 * Calcula quantos minutos de condução contínua decorreram desde a última
 * pausa obrigatória cumprida (para saber quando a próxima é devida).
 */
export function drivingMinutesSinceLastValidBreak(
  drivingStartMs: number,
  blocks: BreakBlock[],
  nowMs: number
): number {
  const validation = validateBreakBlocks(blocks, nowMs);
  let lastValidEnd = drivingStartMs;
  let accumulated = 0;

  for (const block of validation.acceptedBlocks) {
    const end = Math.min(block.endMs, nowMs);
    accumulated += blockDurationMin(block, nowMs);
    // Só um bloco (ou sequência) que cumpra 45 min valida a obrigação
    if (accumulated >= BREAK_CONTINUOUS_MIN) {
      lastValidEnd = end;
      accumulated = 0;
    }
  }

  return Math.max(0, Math.floor((nowMs - lastValidEnd) / 60000));
}
