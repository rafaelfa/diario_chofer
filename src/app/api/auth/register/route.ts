import { NextRequest, NextResponse } from 'next/server';
import { createUser, isCsrfSafe} from '@/lib/auth';
import { logError } from '@/lib/logger';
import { AUTH_RATE_LIMITS, checkRateLimit, getClientIp } from '@/lib/rate-limit';

// POST - Criar novo usuário
export async function POST(request: NextRequest) {
  try {
    if (!isCsrfSafe(request)) {
      return NextResponse.json({ error: 'Requisição bloqueada (origem inválida)' }, { status: 403 });
    }

    const clientIp = getClientIp(request);
    const rateLimit = await checkRateLimit(`register:${clientIp}`, AUTH_RATE_LIMITS.register.maxAttempts, AUTH_RATE_LIMITS.register.windowMs);
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: 'Muitas tentativas de cadastro. Tente novamente mais tarde.' },
        {
          status: 429,
          headers: {
            'Retry-After': rateLimit.retryAfter.toString(),
            'X-RateLimit-Limit': AUTH_RATE_LIMITS.register.maxAttempts.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': rateLimit.resetTime.toString(),
          },
        }
      );
    }

    const body = await request.json();
    const username = typeof body.username === 'string' ? body.username.trim() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const name = typeof body.name === 'string' ? body.name.trim() : undefined;

    // Validações
    if (!username || !password) {
      return NextResponse.json(
        { error: 'Usuário e senha são obrigatórios' },
        { status: 400 }
      );
    }

    if (username.length < 3) {
      return NextResponse.json(
        { error: 'Usuário deve ter pelo menos 3 caracteres' },
        { status: 400 }
      );
    }

    if (username.length > 32 || !/^[a-zA-Z0-9_.-]+$/.test(username)) {
      return NextResponse.json(
        { error: 'Usuário deve ter até 32 caracteres e usar apenas letras, números, ponto, hífen ou sublinhado' },
        { status: 400 }
      );
    }

    if (password.length < 8 || new TextEncoder().encode(password).length > 72) {
      return NextResponse.json(
        { error: 'Senha deve ter pelo menos 8 caracteres e no máximo 72 bytes' },
        { status: 400 }
      );
    }
    if (name && name.length > 100) {
      return NextResponse.json({ error: 'Nome deve ter até 100 caracteres' }, { status: 400 });
    }

    // Criar usuário (verifica se o username já existe internamente)
    const result = await createUser(username, password, name);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Usuário criado com sucesso! Faça login.' 
    });
  } catch (error) {
    logError('Erro no registro:', error);
    return NextResponse.json(
      { error: 'Erro ao criar usuário' },
      { status: 500 }
    );
  }
}
