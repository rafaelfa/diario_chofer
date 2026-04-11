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

// Criar hash da senha
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

// Verificar senha
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// Criar token JWT
export async function createToken(payload: { userId: string; username: string }): Promise<string> {
  const secret = getSecretKey();
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d') // Token válido por 7 dias
    .sign(secret);
}

// Verificar token JWT
export async function verifyToken(token: string): Promise<{ userId: string; username: string } | null> {
  try {
    const secret = getSecretKey();
    const { payload } = await jwtVerify(token, secret);
    return payload as { userId: string; username: string };
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
    maxAge: 60 * 60 * 24 * 7, // 7 dias
    path: '/',
  });
}

// Obter sessão atual
export async function getSession(): Promise<{ userId: string; username: string } | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('session')?.value;

  if (!token) return null;

  return verifyToken(token);
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
export async function authenticateUser(username: string, password: string): Promise<{ success: boolean; userId?: string; username?: string; error?: string }> {
  try {
    const user = await db.appUser.findUnique({
      where: { username },
    });

    if (!user) {
      return { success: false, error: 'Usuário não encontrado' };
    }

    const isValid = await verifyPassword(password, user.passwordHash);

    if (!isValid) {
      return { success: false, error: 'Senha incorreta' };
    }

    return { success: true, userId: user.id, username: user.username };
  } catch (error) {
    logError('Erro ao autenticar:', error);
    return { success: false, error: 'Erro ao autenticar' };
  }
}
