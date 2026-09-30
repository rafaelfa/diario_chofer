import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser, createSession, isCsrfSafe } from '@/lib/auth';
import { AUTH_RATE_LIMITS, checkRateLimit, resetRateLimit, getClientIp } from '@/lib/rate-limit';
import { logError } from '@/lib/logger';

// POST - Login com Rate Limiting (por IP + por username) e proteção CSRF
export async function POST(request: NextRequest) {
  try {
    if (!isCsrfSafe(request)) {
      return NextResponse.json({ error: 'Requisição bloqueada (origem inválida)' }, { status: 403 });
    }

    // ✅ RATE LIMITING: Verificar limite de tentativas por IP
    const clientIp = getClientIp(request);
    const rateLimitResult = await checkRateLimit(`login:${clientIp}`, AUTH_RATE_LIMITS.login.maxAttempts, AUTH_RATE_LIMITS.login.windowMs);

    // Headers de rate limit para o cliente
    const rateLimitHeaders = {
      'X-RateLimit-Limit': AUTH_RATE_LIMITS.login.maxAttempts.toString(),
      'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
      'X-RateLimit-Reset': rateLimitResult.resetTime.toString(),
    };

    // Se excedeu o limite, retornar erro 429
    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          error: 'Muitas tentativas de login. Tente novamente mais tarde.',
          retryAfter: rateLimitResult.retryAfter
        },
        {
          status: 429,
          headers: {
            ...rateLimitHeaders,
            'Retry-After': rateLimitResult.retryAfter.toString(),
          }
        }
      );
    }

    const body = await request.json();
    const { username, password } = body;

    // Validações
    if (!username || !password) {
      return NextResponse.json(
        { error: 'Usuário e senha são obrigatórios' },
        { status: 400, headers: rateLimitHeaders }
      );
    }

    // ✅ RATE LIMITING por username: impede força bruta distribuída contra uma conta
    const userLimit = await checkRateLimit(
      `login-user:${String(username).toLowerCase()}`,
      AUTH_RATE_LIMITS.loginPerUser.maxAttempts,
      AUTH_RATE_LIMITS.loginPerUser.windowMs
    );
    if (!userLimit.success) {
      return NextResponse.json(
        { error: 'Muitas tentativas para este usuário. Tente novamente mais tarde.' },
        { status: 429, headers: { ...rateLimitHeaders, 'Retry-After': userLimit.retryAfter.toString() } }
      );
    }

    // Autenticar
    const result = await authenticateUser(username, password);

    if (!result.success) {
      // ✅ Falha no login: não resetar o rate limit (continua contando)
      return NextResponse.json(
        {
          error: result.error,
          remaining: rateLimitResult.remaining
        },
        { status: 401, headers: rateLimitHeaders }
      );
    }

    // ✅ Sucesso no login: resetar os rate limits deste IP e do username
    await resetRateLimit(`login:${clientIp}`);
    await resetRateLimit(`login-user:${String(username).toLowerCase()}`);

    // Criar sessão
    await createSession(result.userId!, result.username!);

    return NextResponse.json({
      success: true,
      user: { username: result.username }
    });
  } catch (error) {
    logError('Erro no login:', error);
    return NextResponse.json(
      { error: 'Erro ao fazer login' },
      { status: 500 }
    );
  }
}
