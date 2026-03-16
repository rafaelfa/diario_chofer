import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const SECRET_KEY = process.env.JWT_SECRET || 'sua-chave-secreta-muito-segura-mude-no-vercel';

const publicRoutes = ['/login', '/api/auth/login', '/api/auth/register', '/api/auth/me'];
const staticRoutes = ['/_next', '/favicon.ico', '/icon-', '/logo', '/manifest', '/robots'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (publicRoutes.some(route => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  if (staticRoutes.some(route => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  const token = request.cookies.get('session')?.value;

  if (!token) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }

  try {
    const { jwtVerify } = await import('jose');
    const secret = new TextEncoder().encode(SECRET_KEY);
    await jwtVerify(token, secret);
    return NextResponse.next();
  } catch {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Sessão expirada' }, { status: 401 });
    }
    const response = NextResponse.redirect(new URL('/login', request.url));
    response.cookies.delete('session');
    return response;
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|sw.js).*)'],
};
