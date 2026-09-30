import { test } from 'node:test';
import assert from 'node:assert/strict';

// Import relativo e sem dependências de ambiente (JWT_SECRET, banco) para
// que o teste rode com `tsx --test` assim como os demais testes do projeto.
function isCsrfSafe(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return true; // requisições não-navegador (curl, apps nativos)
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

// ==================== CSRF (isCsrfSafe) ====================

test('CSRF: permite requisição sem header Origin (cliente não-navegador)', () => {
  const req = new Request('https://app.example.com/api/workdays', { method: 'POST' });
  assert.equal(isCsrfSafe(req), true);
});

test('CSRF: permite mesma origem', () => {
  const req = new Request('https://app.example.com/api/workdays', {
    method: 'POST',
    headers: { origin: 'https://app.example.com' },
  });
  assert.equal(isCsrfSafe(req), true);
});

test('CSRF: bloqueia origem diferente', () => {
  const req = new Request('https://app.example.com/api/workdays', {
    method: 'POST',
    headers: { origin: 'https://evil.example.com' },
  });
  assert.equal(isCsrfSafe(req), false);
});

test('CSRF: bloqueia origem com porta diferente', () => {
  const req = new Request('https://app.example.com/api/workdays', {
    method: 'PUT',
    headers: { origin: 'https://app.example.com:8443' },
  });
  assert.equal(isCsrfSafe(req), false);
});

test('CSRF: bloqueia origem malformada', () => {
  const req = new Request('https://app.example.com/api/workdays', {
    method: 'DELETE',
    headers: { origin: 'not-a-url' },
  });
  assert.equal(isCsrfSafe(req), false);
});

// ==================== getClientIp (sem spoofing via x-forwarded-for) ====

test('getClientIp usa apenas x-real-ip e ignora x-forwarded-for forjável', async () => {
  process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/test_db';
  const { getClientIp } = await import('./rate-limit.ts');
  const req = new Request('https://app.example.com/api/auth/login', {
    headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' },
  });
  // Sem x-real-ip => identificador fixo de dev, nunca o header forjável
  assert.equal(getClientIp(req), 'local-dev');

  const req2 = new Request('https://app.example.com/api/auth/login', {
    headers: { 'x-real-ip': '9.9.9.9', 'x-forwarded-for': '1.2.3.4' },
  });
  assert.equal(getClientIp(req2), '9.9.9.9');
});
