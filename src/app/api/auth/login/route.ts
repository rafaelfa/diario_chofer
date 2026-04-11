import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser, createSession } from '@/lib/auth';
import { checkRateLimit, resetRateLimit, getClientIp } from '@/lib/rate-limit';
import { logError } from '@/lib/logger';

// POST - Login com Rate Limiting
export async function POST(request: NextRequest) {
  try {
    // ✅ RATE LIMITING: Verificar limite de tentativas por IP
    const clientIp = getClientIp(request);
    const rateLimitResult = checkRateLimit(clientIp, 5, 15 * 60 * 1000); // 5 tentativas em 15 min

    // Headers de rate limit para o cliente
    const rateLimitHeaders = {
      'X-RateLimit-Limit': '5',
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

    // ✅ Sucesso no login: resetar o rate limit para este IP
    resetRateLimit(clientIp);

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
