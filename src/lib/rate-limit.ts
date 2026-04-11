/**
 * Rate Limiting para proteção contra brute force
 *
 * NOTA: Esta implementação usa um Map em memória.
 * No Vercel serverless, isso NÃO persiste entre invocações frias.
 *
 * Para produção com múltiplos usuários, considere usar:
 * - Upstash Redis (https://upstash.com) - gratuito até 10k req/dia
 * - Vercel Edge Config
 * - Database-backed rate limiting
 *
 * Para uso pessoal (um único usuário), esta implementação é suficiente.
 */

/**
 * PRODUCTION UPGRADE PATH:
 * ------------------------
 * For production deployments with multiple concurrent users, replace the in-memory
 * Map with a distributed rate limiting solution. Recommended options:
 *
 * 1. Upstash Redis (free tier: 10k req/day):
 *    npm install @upstash/redis
 *    import { Redis } from '@upstash/redis'
 *    const redis = new Redis({ url: process.env.UPSTASH_REDIS_REST_URL!, token: process.env.UPSTASH_REDIS_REST_TOKEN! })
 *
 * 2. Vercel Edge Config:
 *    Use @vercel/edge-config for lightweight rate limiting at the edge.
 *
 * 3. Database-backed:
 *    Store rate limit entries in the PostgreSQL database with TTL.
 *    CREATE TABLE rate_limits (id TEXT PRIMARY KEY, count INT, reset_time TIMESTAMPTZ);
 *
 * Until then, the in-memory approach works for single-user deployments.
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// Store em memória (não persiste em serverless entre invocações frias)
const rateLimitStore = new Map<string, RateLimitEntry>();

// Configuração padrão
const DEFAULT_MAX_ATTEMPTS = 5;     // Máximo de tentativas
const DEFAULT_WINDOW_MS = 15 * 60 * 1000; // Janela de 15 minutos

/**
 * Verifica se um IP excedeu o limite de tentativas
 * @param identifier - IP ou identificador único
 * @param maxAttempts - Máximo de tentativas permitidas
 * @param windowMs - Janela de tempo em milissegundos
 * @returns Objeto com resultado e informações do rate limit
 */
export function checkRateLimit(
  identifier: string,
  maxAttempts: number = DEFAULT_MAX_ATTEMPTS,
  windowMs: number = DEFAULT_WINDOW_MS
): {
  success: boolean;
  remaining: number;
  resetTime: number;
  retryAfter: number;
} {
  const now = Date.now();
  const entry = rateLimitStore.get(identifier);

  // Se não existe entrada ou já expirou, criar nova
  if (!entry || now > entry.resetTime) {
    const newEntry: RateLimitEntry = {
      count: 1,
      resetTime: now + windowMs
    };
    rateLimitStore.set(identifier, newEntry);

    return {
      success: true,
      remaining: maxAttempts - 1,
      resetTime: newEntry.resetTime,
      retryAfter: 0
    };
  }

  // Verificar se excedeu o limite
  if (entry.count >= maxAttempts) {
    return {
      success: false,
      remaining: 0,
      resetTime: entry.resetTime,
      retryAfter: Math.ceil((entry.resetTime - now) / 1000) // segundos
    };
  }

  // Incrementar contador
  entry.count++;
  rateLimitStore.set(identifier, entry);

  return {
    success: true,
    remaining: maxAttempts - entry.count,
    resetTime: entry.resetTime,
    retryAfter: 0
  };
}

/**
 * Reseta o contador de rate limit para um identificador
 * Usado após login bem-sucedido
 */
export function resetRateLimit(identifier: string): void {
  rateLimitStore.delete(identifier);
}

/**
 * Extrai o IP do cliente de uma requisição Next.js
 * Considera proxies e headers do Vercel
 */
export function getClientIp(request: Request): string {
  // Vercel headers
  const xForwardedFor = request.headers.get('x-forwarded-for');
  if (xForwardedFor) {
    // Pode conter múltiplos IPs, pegar o primeiro
    return xForwardedFor.split(',')[0].trim();
  }

  // Outros headers comuns
  const xRealIp = request.headers.get('x-real-ip');
  if (xRealIp) {
    return xRealIp;
  }

  // Fallback para desenvolvimento local
  return 'unknown';
}

/**
 * Limpa entradas expiradas do store (executar periodicamente)
 */
export function cleanupExpiredEntries(): void {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}

// Executar limpeza a cada 5 minutos
if (typeof setInterval !== 'undefined') {
  setInterval(cleanupExpiredEntries, 5 * 60 * 1000);
}
