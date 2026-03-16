import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';
import { db } from './db';

const SECRET_KEY = process.env.JWT_SECRET || 'sua-chave-secreta-muito-segura-mude-no-vercel';

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
  const secret = new TextEncoder().encode(SECRET_KEY);
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d') // Token válido por 7 dias
    .sign(secret);
}

// Verificar token JWT
export async function verifyToken(token: string): Promise<{ userId: string; username: string } | null> {
  try {
    const secret = new TextEncoder().encode(SECRET_KEY);
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

// Verificar se existe algum usuário
export async function hasUsers(): Promise<boolean> {
  const count = await db.appUser.count();
  return count > 0;
}

// Criar primeiro usuário (setup inicial)
export async function createFirstUser(username: string, password: string, name?: string): Promise<{ success: boolean; error?: string }> {
  try {
    const existingUsers = await hasUsers();
    if (existingUsers) {
      return { success: false, error: 'Já existe um usuário registado' };
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
    console.error('Erro ao criar usuário:', error);
    return { success: false, error: 'Erro ao criar usuário' };
  }
}

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
    console.error('Erro ao autenticar:', error);
    return { success: false, error: 'Erro ao autenticar' };
  }
}
