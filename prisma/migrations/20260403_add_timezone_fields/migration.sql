-- CreateTable: Adicionar campos de fuso horário para auditoria multi-país
-- Migração v4.0.1 — Diário do Motorista

-- Adicionar campos de timezone na tabela work_days
ALTER TABLE "work_days" ADD COLUMN "timezone" TEXT;
ALTER TABLE "work_days" ADD COLUMN "utc_offset" TEXT;

-- Adicionar campo de offset UTC na tabela driving_sessions
ALTER TABLE "driving_sessions" ADD COLUMN "utc_offset" TEXT;

-- Comentários para documentação
COMMENT ON COLUMN "work_days"."timezone" IS 'Fuso horário no início do dia (ex: Europe/Lisbon)';
COMMENT ON COLUMN "work_days"."utc_offset" IS 'Offset UTC no início (ex: +01:00 ou +00:00)';
COMMENT ON COLUMN "driving_sessions"."utc_offset" IS 'Offset UTC no momento da sessão (ex: +01:00)';
