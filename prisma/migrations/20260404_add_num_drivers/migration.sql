-- Adicionar campo numDrivers na tabela work_days
-- 1 = motorista único, 2 = equipa com 2 motoristas
ALTER TABLE "work_days" ADD COLUMN "num_drivers" INTEGER NOT NULL DEFAULT 1;
