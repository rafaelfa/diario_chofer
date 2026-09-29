import { NextRequest, NextResponse } from 'next/server';
import { destroySession, isCsrfSafe } from '@/lib/auth';
import { logError } from '@/lib/logger';

// POST - Logout (destroy session)
export async function POST(request: NextRequest) {
  try {
    if (!isCsrfSafe(request)) {
      return NextResponse.json({ error: 'Requisição bloqueada (origem inválida)' }, { status: 403 });
    }
    await destroySession();
    return NextResponse.json({ success: true });
  } catch (error) {
    logError('Erro ao fazer logout:', error);
    return NextResponse.json({ error: 'Erro ao fazer logout' }, { status: 500 });
  }
}
