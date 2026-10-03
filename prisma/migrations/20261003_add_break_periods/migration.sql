CREATE TABLE "break_periods" (
    "id" TEXT NOT NULL,
    "work_day_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'continuous',
    "started_at" TIMESTAMP(3) NOT NULL,
    "ended_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "break_periods_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "break_periods_work_day_id_started_at_key"
    ON "break_periods"("work_day_id", "started_at");
CREATE INDEX "break_periods_user_id_idx" ON "break_periods"("user_id");
CREATE INDEX "break_periods_work_day_id_started_at_idx"
    ON "break_periods"("work_day_id", "started_at");

ALTER TABLE "break_periods"
    ADD CONSTRAINT "break_periods_work_day_id_fkey"
    FOREIGN KEY ("work_day_id") REFERENCES "work_days"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "break_periods"
    ADD CONSTRAINT "break_periods_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "app_users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
