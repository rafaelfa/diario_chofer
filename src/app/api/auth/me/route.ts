import { NextResponse } from 'next/server';
import { getSession, hasUsers } from '@/lib/auth';

// GET - Verificar sessão atual
export async function GET() {
  try {
    const session = await getSession();
    const usersExist = await hasUsers();

    if (!session) {
      return NextResponse.json({ 
        authenticated: false,
        hasUsers: usersExist 
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
    console.error('Erro ao verificar sessão:', error);
    return NextResponse.json(
      { error: 'Erro ao verificar sessão' },
      { status: 500 }
    );
  }
}
