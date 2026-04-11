/**
 * Validadores centralizados — elimina regex duplicada em 4 locais.
 * (REDUND-05 do relatório de análise v4.0.1)
 */

/** Regex para validar matrícula no formato AA-00-BB */
export const MATRICULA_REGEX = /^[A-Z]{2}-\d{2}-[A-Z0-9]{2}$/;

/**
 * Valida se uma matrícula está no formato correto (AA-00-BB).
 * Aceita string em qualquer case e normaliza para maiúsculas.
 */
export function validateMatricula(matricula: string): { valid: boolean; normalized: string } {
  const normalized = matricula.toUpperCase().trim();
  return { valid: MATRICULA_REGEX.test(normalized), normalized };
}
