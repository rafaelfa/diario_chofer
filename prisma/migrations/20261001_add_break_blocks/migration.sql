-- Blocos de pausa concluídos (Reg. 561/2006 Art. 7: par 15+30 em <=75 min)
ALTER TABLE "work_days" ADD COLUMN IF NOT EXISTS "break_blocks" JSONB;
