/**
 * Logger condicional — substitui os 22 console.log nas rotas da API.
 *
 * Em desenvolvimento: imprime normalmente.
 * Em produção: silencia os logs de debug (nunca expõe dados de utilizador nos logs do Vercel).
 *
 * USO:
 *   import { log, logError } from '@/lib/logger';
 *
 *   log('Dados recebidos:', body);        // só aparece em dev
 *   logError('Erro ao criar dia:', error); // aparece sempre (crítico)
 */

const isDev = process.env.NODE_ENV === 'development';

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Log de debug — apenas em desenvolvimento */
export function log(...args: any[]): void {
  if (isDev) {
    console.log(...args);
  }
}

/** Log de aviso — apenas em desenvolvimento */
export function logWarn(...args: any[]): void {
  if (isDev) {
    console.warn(...args);
  }
}

/** Log de erro — sempre visível (erros de servidor precisam de monitorização) */
export function logError(...args: any[]): void {
  console.error(...args);
}

/** Log de info — sempre visível mas sem dados sensíveis */
export function logInfo(message: string): void {
  console.info(`[INFO] ${new Date().toISOString()} — ${message}`);
}
