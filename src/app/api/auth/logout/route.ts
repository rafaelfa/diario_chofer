import { NextResponse } from 'next/server';
import { destroySession } from '@/lib/auth';
import { logError } from '@/lib/logger';

// POST - Logout (destroy session)
export async function POST() {
  try {
    await destroySession();
    return NextResponse.json({ success: true });
  } catch (error) {
    logError('Erro ao fazer logout:', error);
    return NextResponse.json({ error: 'Erro ao fazer logout' }, { status: 500 });
  }
}
