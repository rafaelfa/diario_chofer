import { db } from '@/lib/db';

// Configuração padrão
const DEFAULT_MAX_ATTEMPTS = 5;     // Máximo de tentativas
const DEFAULT_WINDOW_MS = 15 * 60 * 1000; // Janela de 15 minutos
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;
let lastCleanup = 0;

export const AUTH_RATE_LIMITS = {
  login: { maxAttempts: DEFAULT_MAX_ATTEMPTS, windowMs: DEFAULT_WINDOW_MS },
  // Limite adicional por username: mitiga ataques distribuídos por IP contra uma conta
  loginPerUser: { maxAttempts: 5, windowMs: 15 * 60 * 1000 },
  register: { maxAttempts: 3, windowMs: 60 * 60 * 1000 },
} as const;

/**
 * Verifica se um IP excedeu o limite de tentativas
 * @param identifier - IP ou identificador único
 * @param maxAttempts - Máximo de tentativas permitidas
 * @param windowMs - Janela de tempo em milissegundos
 * @returns Objeto com resultado e informações do rate limit
 */
export async function checkRateLimit(
  identifier: string,
  maxAttempts: number = DEFAULT_MAX_ATTEMPTS,
  windowMs: number = DEFAULT_WINDOW_MS
): Promise<{
  success: boolean;
  remaining: number;
  resetTime: number;
  retryAfter: number;
}> {
  const now = Date.now();
  const entries = await db.$queryRaw<Array<{ count: number; reset_at: Date }>>`
    INSERT INTO "rate_limits" ("identifier", "count", "reset_at", "updated_at")
    VALUES (${identifier}, 1, CURRENT_TIMESTAMP + (${windowMs} * INTERVAL '1 millisecond'), CURRENT_TIMESTAMP)
    ON CONFLICT ("identifier") DO UPDATE SET
      "count" = CASE
        WHEN "rate_limits"."reset_at" <= CURRENT_TIMESTAMP THEN 1
        WHEN "rate_limits"."count" > ${maxAttempts} THEN "rate_limits"."count"
        ELSE "rate_limits"."count" + 1
      END,
      "reset_at" = CASE
        WHEN "rate_limits"."reset_at" <= CURRENT_TIMESTAMP
          THEN CURRENT_TIMESTAMP + (${windowMs} * INTERVAL '1 millisecond')
        ELSE "rate_limits"."reset_at"
      END,
      "updated_at" = CURRENT_TIMESTAMP
    RETURNING "count", "reset_at"
  `;

  if (now - lastCleanup >= CLEANUP_INTERVAL_MS) {
    lastCleanup = now;
    void db.rateLimit.deleteMany({ where: { resetAt: { lt: new Date(now - 24 * 60 * 60 * 1000) } } }).catch(() => undefined);
  }

  const entry = entries[0];
  const resetTime = new Date(entry.reset_at).getTime();
  const success = entry.count <= maxAttempts;
  return {
    success,
    remaining: Math.max(0, maxAttempts - entry.count),
    resetTime,
    retryAfter: success ? 0 : Math.max(1, Math.ceil((resetTime - now) / 1000)),
  };
}

/**
 * Reseta o contador de rate limit para um identificador
 * Usado após login bem-sucedido
 */
export async function resetRateLimit(identifier: string): Promise<void> {
  await db.rateLimit.deleteMany({ where: { identifier } });
}

/**
 * Extrai o IP do cliente de uma requisição Next.js.
 *
 * SEGURANÇA: usa APENAS `x-real-ip`, que é definido pelo edge da Vercel e não
 * pode ser forjado pelo cliente. Headers como `x-forwarded-for` são controláveis
 * pelo remetente em ambientes sem proxy confiável — usá-los permitiria bypass
 * do rate limit via spoofing de IP. Em desenvolvimento local (sem Vercel),
 * retorna um identificador fixo.
 */
export function getClientIp(request: Request): string {
  const xRealIp = request.headers.get('x-real-ip');
  if (xRealIp) {
    return xRealIp;
  }

  // Fallback para desenvolvimento local (todas as reqs locais compartilham o bucket)
  return 'local-dev';
}
