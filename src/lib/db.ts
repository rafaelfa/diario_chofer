import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Configuração otimizada para Supabase Pooler
// Desabilitamos prepared statements para evitar conflitos no ambiente serverless
export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  })

// Evita criar múltiplas instâncias em desenvolvimento
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
