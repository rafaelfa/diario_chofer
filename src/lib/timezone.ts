/**
 * Utilitários de fuso horário — centraliza toda a lógica de timezone.
 *
 * Resolve os bugs identificados na análise v3.9.9:
 *   1. toISOString().split('T')[0] → getLocalDateString() (usava UTC, agora usa local)
 *   2. Server-side new Date().toTimeString() → cliente envia currentTime
 *   3. Sem auditoria de fuso → timezone + utcOffset gravados na DB
 *
 * IMPORTANTE: Estes helpers são para uso no CLIENTE (browser).
 * O servidor deve receber os dados do cliente, nunca gerar timestamps próprios.
 */

/**
 * Retorna a data actual no formato "YYYY-MM-DD" usando o fuso horário LOCAL do browser.
 * Substitui o bug `now.toISOString().split('T')[0]` que retornava a data UTC.
 *
 * Exemplo (verão em Portugal, UTC+1):
 *   São 00:30 local (23:30 UTC) → getLocalDateString() = "2025-07-16"
 *   toISOString().split('T')[0] = "2025-07-15" ← ERRADO
 */
export function getLocalDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Retorna a hora actual no formato "HH:MM" usando o fuso horário LOCAL do browser.
 * Equivalente a `new Date().toTimeString().slice(0, 5)` mas mais explícito.
 */
export function getLocalTimeString(date: Date = new Date()): string {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * Retorna o nome do fuso horário do browser (ex: "Europe/Lisbon", "Europe/Madrid").
 * Usa a API Intl que é suportada por todos os browsers modernos.
 */
export function getClientTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return 'UTC'; // Fallback seguro
  }
}

/**
 * Retorna o offset UTC actual no formato "+HH:MM" ou "-HH:MM".
 * Exemplo: Portugal no inverno → "+00:00", Espanha no verão → "+02:00"
 *
 * É calculado em runtime porque o offset pode mudar com DST (horário de verão/inverno).
 */
export function getUtcOffsetString(date: Date = new Date()): string {
  const offsetMinutes = -date.getTimezoneOffset(); // getTimezoneOffset returns inverted
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const absMinutes = Math.abs(offsetMinutes);
  const hours = String(Math.floor(absMinutes / 60)).padStart(2, '0');
  const minutes = String(absMinutes % 60).padStart(2, '0');
  return `${sign}${hours}:${minutes}`;
}

/**
 * Converte uma data para string ISO usando o fuso horário LOCAL.
 * Útil para enviar datas ao servidor sem distorção de UTC.
 *
 * Exemplo: "2025-07-16T14:30:00.000" (sem Z = hora local)
 */
export function toLocalISOString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
}

/**
 * Formata uma data string para exibição no locale pt-PT.
 * Se a string for um formato de data ISO (contém 'T'), trata-a correctamente.
 */
export function formatDatePt(dateStr: string, options?: Intl.DateTimeFormatOptions): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;

  const defaultOptions: Intl.DateTimeFormatOptions = {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
  };

  return date.toLocaleDateString('pt-PT', options || defaultOptions);
}

/**
 * Formata uma data para exibição no locale pt-PT no SERVIDOR.
 * Aceita um timezone opcional para forçar a formatação correcta.
 */
export function formatDatePtServer(
  date: Date | string,
  timezone?: string | null,
  options?: Intl.DateTimeFormatOptions
): string {
  if (!date) return '';

  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '';

  const defaultOptions: Intl.DateTimeFormatOptions = {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
  };

  const formatOptions = options || defaultOptions;

  // Se temos timezone, forçar formatação nesse fuso
  if (timezone) {
    return d.toLocaleDateString('pt-PT', { ...formatOptions, timeZone: timezone });
  }

  return d.toLocaleDateString('pt-PT', formatOptions);
}
