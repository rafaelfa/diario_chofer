/**
 * Blocos de pausa — Reg. CE 561/2006, Art. 7º
 *
 * A pausa de 45 minutos pode ser substituída por um par de pausas
 * de 15 + 30 minutos distribuídas de forma intercalada com o trabalho.
 *
 * Este módulo guarda a lógica partilhada (cálculo dos blocos de pausa
 * concluídos e avaliação do requisito legal) para que o cronómetro
 * (BreakTimer) e os cálculos de conformidade usem as mesmas regras.
 */

export interface BreakBlock {
  /** Início do bloco (ISO string) */
  start: string;
  /** Fim do bloco (ISO string) */
  end: string;
}

/** Pausa contínua legal: 45 minutos */
export const CONTINUOUS_BREAK_MIN = 45;
/** 1.º bloco do par legal: 15 minutos */
export const SPLIT_FIRST_BLOCK_MIN = 15;
/** 2.º bloco do par legal: 30 minutos */
export const SPLIT_SECOND_BLOCK_MIN = 30;
/** Janela máxima entre o início do 1.º bloco e o fim do 2.º: 75 minutos */
export const SPLIT_WINDOW_MIN = 75;

/** Converte blocos (datas ISO) em durações em minutos */
export function blocksToMinutes(blocks: BreakBlock[]): number[] {
  return blocks.map(b => {
    const s = new Date(b.start).getTime();
    const e = new Date(b.end).getTime();
    if (Number.isNaN(s) || Number.isNaN(e)) return 0;
    return Math.max(0, Math.floor((e - s) / 60000));
  });
}

/** Total de minutos acumulados nos blocos concluídos */
export function totalBreakMinutes(blocks: BreakBlock[]): number {
  return blocksToMinutes(blocks).reduce((acc, m) => acc + m, 0);
}

/**
 * Avalia se os blocos de pausa já concluídos renovam o período de condução
 * (Art. 7º do Reg. 561/2006):
 *   - um bloco contínuo ≥ 45 min, OU
 *   - um par 15 + 30 cujo 2.º bloco termina ≤ 75 min após o início do 1.º.
 */
export function satisfiesBreakRequirement(blocks: BreakBlock[]): boolean {
  const durations = blocksToMinutes(blocks);

  // Opção A: pausa contínua de 45 minutos
  if (durations.some(m => m >= CONTINUOUS_BREAK_MIN)) return true;

  // Opção B: par 15 + 30 dentro de uma janela de 75 minutos
  for (let i = 0; i < blocks.length; i++) {
    if (durations[i] < SPLIT_FIRST_BLOCK_MIN) continue;
    const windowStart = new Date(blocks[i].start).getTime();
    if (Number.isNaN(windowStart)) continue;
    for (let j = i + 1; j < blocks.length; j++) {
      if (durations[j] < SPLIT_SECOND_BLOCK_MIN) continue;
      const windowEnd = new Date(blocks[j].end).getTime();
      if (Number.isNaN(windowEnd)) continue;
      if (windowEnd - windowStart <= SPLIT_WINDOW_MIN * 60000) return true;
    }
  }

  return false;
}

/**
 * Normaliza blocos vindos de fontes não confiáveis (localStorage/API),
 * ordenando-os por data de início e descartando entradas inválidas.
 */
export function normalizeBreakBlocks(value: unknown): BreakBlock[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((b): b is BreakBlock =>
      !!b &&
      typeof (b as BreakBlock).start === 'string' &&
      typeof (b as BreakBlock).end === 'string' &&
      !Number.isNaN(new Date((b as BreakBlock).start).getTime()) &&
      !Number.isNaN(new Date((b as BreakBlock).end).getTime())
    )
    .map(b => ({ start: b.start, end: b.end }))
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
}
