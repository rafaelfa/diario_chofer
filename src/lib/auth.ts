import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';
import { db } from './db';
import { logError } from './logger';

// SECRET_KEY: Lançar erro se não definido (SEM fallback inseguro)
const getSecretKey = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET não está definido nas variáveis de ambiente. Configure no Vercel.');
  }
  return new TextEncoder().encode(secret);
};

/** Validade da sessão reduzida para 24h (mitiga JWT não revogável). */
const SESSION_MAX_AGE_S = 60 * 60 * 24;

// Criar hash da senha
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

/**
 * Verifica senha com tempo constante: mesmo que o usuário não exista,
 * executa uma comparação bcrypt contra um hash dummy, evitando que um
 * atacante diferencie "usuário existe" de "senha errada" por timing.
 */
const DUMMY_HASH = bcrypt.hashSync('dummy-password-for-timing', 12);

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// Criar token JWT
export async function createToken(payload: { userId: string; username: string }): Promise<string> {
  const secret = getSecretKey();
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_S}s`)
    .sign(secret);
}

interface TokenPayload {
  userId: string;
  username: string;
}

// Verificar token JWT (com validação de claims em runtime, sem cast cego)
export async function verifyToken(token: string): Promise<(TokenPayload & { iat?: number }) | null> {
  try {
    const secret = getSecretKey();
    const { payload } = await jwtVerify(token, secret);
    const userId = payload.userId;
    const username = payload.username;
    if (typeof userId !== 'string' || typeof username !== 'string') return null;
    return { userId, username, iat: payload.iat };
  } catch {
    return null;
  }
}

// Criar sessão (set cookie)
export async function createSession(userId: string, username: string): Promise<void> {
  const token = await createToken({ userId, username });
  const cookieStore = await cookies();

  cookieStore.set('session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE_S,
    path: '/',
  });
}

// Obter sessão atual
export async function getSession(): Promise<{ userId: string; username: string } | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('session')?.value;

  if (!token) return null;

  const session = await verifyToken(token);
  if (!session) return null;

  // Revogação de sessão: tokens emitidos antes da última atualização de senha
  // (updatedAt do usuário) são considerados inválidos.
  const user = await db.appUser.findUnique({
    where: { id: session.userId },
    select: { updatedAt: true },
  });
  if (!user) return null;
  if (session.iat && Math.floor(user.updatedAt.getTime() / 1000) > session.iat) {
    return null; // credenciais alteradas após a emissão do token
  }

  return { userId: session.userId, username: session.username };
}

// Destruir sessão (logout)
export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete('session');
}

// ==================== FUNÇÕES DE AUTENTICAÇÃO PARA ROTAS ====================

/**
 * Função obrigatória para rotas protegidas.
 * Retorna o userId do usuário autenticado ou lança erro.
 * USAR NO INÍCIO DE TODAS AS ROTAS PROTEGIDAS.
 */
export async function requireAuth(): Promise<{ userId: string; username: string }> {
  const session = await getSession();
  
  if (!session) {
    throw new Error('UNAUTHORIZED');
  }
  
  return session;
}

/**
 * Wrapper para rotas de API que exigem autenticação.
 * Captura erros de autenticação e retorna resposta apropriada.
 */
export async function withAuth<T>(
  handler: (userId: string, username: string) => Promise<T>
): Promise<T | { error: string; status: number }> {
  try {
    const { userId, username } = await requireAuth();
    return await handler(userId, username);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('UNAUTHORIZED')) {
      return { error: 'Não autorizado', status: 401 };
    }
    throw error;
  }
}

// Verificar se existe algum usuário
export async function hasUsers(): Promise<boolean> {
  const count = await db.appUser.count();
  return count > 0;
}

// Criar usuário (permite múltiplos usuários)
export async function createUser(username: string, password: string, name?: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Verificar se o username já existe
    const existingUser = await db.appUser.findUnique({
      where: { username },
    });

    if (existingUser) {
      return { success: false, error: 'Este nome de usuário já está em uso' };
    }

    const passwordHash = await hashPassword(password);

    await db.appUser.create({
      data: {
        username,
        passwordHash,
        name: name || username,
      },
    });

    return { success: true };
  } catch (error) {
    logError('Erro ao criar usuário:', error);
    return { success: false, error: 'Erro ao criar usuário' };
  }
}

// Manter compatibilidade com código existente
export const createFirstUser = createUser;

// Autenticar usuário
// SEGURANÇA: mensagens unificadas ("Credenciais inválidas") + verificação de
// tempo constante para evitar enumeração de usuários por timing.
export async function authenticateUser(username: string, password: string): Promise<{ success: boolean; userId?: string; username?: string; error?: string }> {
  try {
    const user = await db.appUser.findUnique({
      where: { username },
    });

    const hash = user ? user.passwordHash : DUMMY_HASH;
    const isValid = await verifyPassword(password, hash);

    if (!user || !isValid) {
      return { success: false, error: 'Credenciais inválidas' };
    }

    return { success: true, userId: user.id, username: user.username };
  } catch (error) {
    logError('Erro ao autenticar:', error);
    return { success: false, error: 'Credenciais inválidas' };
  }
}

/**
 * Proteção CSRF para rotas de API mutantes (POST/PUT/PATCH/DELETE).
 * Navegadores enviam o header Origin em requisições cross-origin com cookies;
 * se a origem não bater com o host da requisição, a mutação é rejeitada.
 */
export function isCsrfSafe(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return true; // requisições não-navegador (curl, apps nativos)
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}
