-- Pausas flexíveis (Regra 45m ou 15m + 30m): histórico de blocos de pausa medidos.
-- Cada bloco: { "start": ISO, "end": ISO, "minutes": number }
ALTER TABLE "work_days" ADD COLUMN IF NOT EXISTS "break_blocks" JSONB;
