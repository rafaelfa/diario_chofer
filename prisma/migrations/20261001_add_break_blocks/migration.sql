-- Adiciona a coluna break_blocks (JSON) para persistir os blocos de pausa com timestamps reais.
-- Usado pelo contador de condução contínua (renovação dos 4h30 — Reg. CE 561/2006, Art. 7).
ALTER TABLE "work_days" ADD COLUMN IF NOT EXISTS "break_blocks" JSONB;
