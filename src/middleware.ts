import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const SECRET_KEY = process.env.JWT_SECRET || 'sua-chave-secreta-muito-segura-mude-no-vercel';

// Rotas que não precisam de autenticação
const publicRoutes = ['/login', '/api/auth/login', '/api/auth/register', '/api/auth/me', '/downloads', '/api/download'];

// Rotas de arquivos estáticos
const staticRoutes = ['/_next', '/favicon.ico', '/icon-', '/logo', '/manifest', '/robots'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Permitir rotas públicas
  if (publicRoutes.some(route => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Permitir arquivos estáticos
  if (staticRoutes.some(route => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Verificar token
  const token = request.cookies.get('session')?.value;

  if (!token) {
    // Sem token, redirecionar para login
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }

  try {
    // Verificar se o token é válido
    const secret = new TextEncoder().encode(SECRET_KEY);
    await jwtVerify(token, secret);
    
    return NextResponse.next();
  } catch {
    // Token inválido, redirecionar para login
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Sessão expirada' }, { status: 401 });
    }
    const response = NextResponse.redirect(new URL('/login', request.url));
    response.cookies.delete('session');
    return response;
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image).*)',
  ],
};
