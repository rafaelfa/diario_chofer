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
  const parts = time.split(':').map(Number);
  if (parts.length !== 2 || parts.some(isNaN)) return null;
  return parts[0] * 60 + parts[1];
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
const MAX_SESSION_HOURS = 12;  // Uma sessão não deve durar mais que 12h
export const MAX_DAY_HOURS = 15;      // Total diário nunca deve exceder 15h

export function calcHoursWorked(
  sessions: Array<{ startTime?: string | null; endTime?: string | null }>,
  fallbackStart?: string | null,
  fallbackEnd?: string | null
): number | null {
  // Só calcular pelas sessões COMPLETAS (com startTime + endTime preenchidos)
  const completedSessions = sessions.filter(
    s => s.startTime && s.endTime
  );

  if (completedSessions.length > 0) {
    const sessionMinutes = completedSessions.reduce((acc, session) => {
      const diff = diffInMinutes(session.startTime, session.endTime);
      if (diff === null) return acc;
      // Ignorar sessões com duração irreal (> 12h = 720 min)
      if (diff > MAX_SESSION_HOURS * 60) return acc;
      return acc + diff;
    }, 0);

    // Proteção: limitar a 15h (900 min)
    const clampedMinutes = Math.min(sessionMinutes, MAX_DAY_HOURS * 60);
    return parseFloat((clampedMinutes / 60).toFixed(2));
  }

  // Fallback: usar horário do dia completo (só se ambos definidos)
  if (fallbackStart && fallbackEnd) {
    const fallbackMinutes = diffInMinutes(fallbackStart, fallbackEnd);
    if (fallbackMinutes === null) return null;
    // Ignorar se a diferença for irreal (> 15h)
    if (fallbackMinutes > MAX_DAY_HOURS * 60) return null;
    return parseFloat((fallbackMinutes / 60).toFixed(2));
  }

  // Sem dados suficientes para calcular
  return null;
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
  const kmFromSessions = sessions.reduce((total, session) => {
    if (session.startKm != null && session.endKm != null) {
      // BUG-03: Proteger contra KM negativos (endKm < startKm)
      if (session.endKm >= session.startKm) {
        return total + (session.endKm - session.startKm);
      }
    }
    return total;
  }, 0);

  if (kmFromSessions > 0) return kmFromSessions;

  if (fallbackStartKm != null && fallbackEndKm != null) {
    // BUG-03: Proteger contra KM negativos (fallbackEndKm < fallbackStartKm)
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
