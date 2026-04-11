import { NextResponse } from 'next/server';
import { getSession, hasUsers } from '@/lib/auth';
import { logError } from '@/lib/logger';

// GET - Verificar sessão atual e se existem utilizadores
export async function GET() {
  try {
    const usersExist = await hasUsers();

    const session = await getSession();

    if (!session) {
      // Retornar hasUsers mesmo sem sessão para a tela de login saber qual formulário mostrar
      return NextResponse.json({
        authenticated: false,
        hasUsers: usersExist,
      });
    }

    return NextResponse.json({
      authenticated: true,
      hasUsers: usersExist,
      user: {
        userId: session.userId,
        username: session.username
      }
    });
  } catch (error) {
    logError('Erro ao verificar sessão:', error);
    return NextResponse.json(
      { authenticated: false, error: 'Erro ao verificar sessão' },
      { status: 500 }
    );
  }
}
