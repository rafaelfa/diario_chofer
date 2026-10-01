-- Adiciona a coluna break_blocks (JSON) à tabela work_days.
-- Guarda os blocos de pausa com timestamps {start, end, minutes} para o
-- controlo do limite de condução contínua de 4h30 (Reg. CE 561/2006, Art. 7).
ALTER TABLE "work_days" ADD COLUMN IF NOT EXISTS "break_blocks" JSONB;
