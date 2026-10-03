-- Base do contador de condução contínua (4h30 — Reg. CE 561/2006, Art. 5º).
-- Guarda os minutos de condução no momento em que a última pausa legal terminou.
ALTER TABLE "work_days" ADD COLUMN IF NOT EXISTS "driving_minutes_at_last_break" INTEGER;
