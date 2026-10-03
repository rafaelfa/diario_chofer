CREATE TABLE IF NOT EXISTS "work_activities" (
    "id" TEXT NOT NULL,
    "work_day_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "driver_number" INTEGER NOT NULL DEFAULT 1,
    "type" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL,
    "ended_at" TIMESTAMP(3),
    "start_km" INTEGER,
    "end_km" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "work_activities_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "work_activities_user_id_idx" ON "work_activities"("user_id");
CREATE INDEX IF NOT EXISTS "work_activities_work_day_id_ended_at_idx" ON "work_activities"("work_day_id", "ended_at");

DO $$ BEGIN
  ALTER TABLE "work_activities" ADD CONSTRAINT "work_activities_work_day_id_fkey"
    FOREIGN KEY ("work_day_id") REFERENCES "work_days"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "work_activities" ADD CONSTRAINT "work_activities_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "app_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;