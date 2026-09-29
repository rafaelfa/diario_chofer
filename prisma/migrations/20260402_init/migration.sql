CREATE TABLE "app_users" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "app_users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "work_days" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "date" TIMESTAMP(3),
    "start_time" TEXT,
    "end_time" TEXT,
    "start_country" TEXT,
    "end_country" TEXT,
    "start_km" INTEGER,
    "end_km" INTEGER,
    "last_rest" TEXT,
    "amplitude" TEXT,
    "truck_check" BOOLEAN NOT NULL DEFAULT false,
    "observations" TEXT,
    "matricula" TEXT,
    "is_paused" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "work_days_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "events" (
    "id" TEXT NOT NULL,
    "work_day_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "time" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "driving_sessions" (
    "id" TEXT NOT NULL,
    "work_day_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "start_time" TEXT,
    "end_time" TEXT,
    "start_km" INTEGER,
    "end_km" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "driving_sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "settings" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "max_daily_driving_hours" DOUBLE PRECISION NOT NULL DEFAULT 9.0,
    "max_weekly_driving_hours" DOUBLE PRECISION NOT NULL DEFAULT 56.0,
    "max_continuous_driving" DOUBLE PRECISION NOT NULL DEFAULT 4.5,
    "break_duration" INTEGER NOT NULL DEFAULT 45,
    "alert_before_minutes" INTEGER NOT NULL DEFAULT 30,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "app_users_username_key" ON "app_users"("username");
CREATE INDEX "work_days_user_id_idx" ON "work_days"("user_id");
CREATE INDEX "work_days_matricula_idx" ON "work_days"("matricula");
CREATE INDEX "work_days_user_id_date_idx" ON "work_days"("user_id", "date");
CREATE INDEX "events_user_id_idx" ON "events"("user_id");
CREATE INDEX "events_work_day_id_idx" ON "events"("work_day_id");
CREATE INDEX "driving_sessions_user_id_idx" ON "driving_sessions"("user_id");
CREATE INDEX "driving_sessions_work_day_id_idx" ON "driving_sessions"("work_day_id");
CREATE INDEX "driving_sessions_user_id_status_idx" ON "driving_sessions"("user_id", "status");
CREATE UNIQUE INDEX "settings_user_id_key" ON "settings"("user_id");
CREATE INDEX "settings_user_id_idx" ON "settings"("user_id");

ALTER TABLE "work_days" ADD CONSTRAINT "work_days_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "app_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "events" ADD CONSTRAINT "events_work_day_id_fkey"
    FOREIGN KEY ("work_day_id") REFERENCES "work_days"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "events" ADD CONSTRAINT "events_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "app_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "driving_sessions" ADD CONSTRAINT "driving_sessions_work_day_id_fkey"
    FOREIGN KEY ("work_day_id") REFERENCES "work_days"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "driving_sessions" ADD CONSTRAINT "driving_sessions_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "app_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "settings" ADD CONSTRAINT "settings_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "app_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;