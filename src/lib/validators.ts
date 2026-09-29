import { parseTimeToMinutes } from '@/lib/time';

/**
 * Validadores centralizados — elimina regex duplicada em 4 locais.
 * (REDUND-05 do relatório de análise v4.0.1)
 */

/** Regex para validar matrícula no formato AA-00-BB */
export const MATRICULA_REGEX = /^[A-Z0-9]{2}-[A-Z0-9]{2}-[A-Z0-9]{2}$/;

/**
 * Valida se uma matrícula está no formato correto (AA-00-BB).
 * Aceita string em qualquer case e normaliza para maiúsculas.
 */
export function validateMatricula(matricula: string): { valid: boolean; normalized: string } {
  const normalized = matricula.toUpperCase().trim();
  return { valid: MATRICULA_REGEX.test(normalized), normalized };
}

export function isValidTimeString(value: unknown): value is string {
  return typeof value === 'string' && parseTimeToMinutes(value) !== null;
}

export function parseNonNegativeInteger(value: unknown): { valid: boolean; value: number | null } {
  if (value === null || value === undefined || value === '') return { valid: true, value: null };
  const parsed = typeof value === 'number' ? value : Number(String(value).trim());
  if (!Number.isSafeInteger(parsed) || parsed < 0) return { valid: false, value: null };
  return { valid: true, value: parsed };
}

export function parseDateOnlyUtc(value: unknown): Date | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value ? date : null;
}

export function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function endOfUtcDay(date: Date): Date {
  const end = startOfUtcDay(date);
  end.setUTCHours(23, 59, 59, 999);
  return end;
}

export function isValidTimezone(value: unknown): value is string | null | undefined {
  if (value === null || value === undefined || value === '') return true;
  if (typeof value !== 'string') return false;
  try {
    new Intl.DateTimeFormat('en', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}
