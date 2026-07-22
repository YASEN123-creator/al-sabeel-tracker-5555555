-- Migration: Prayer Logs Table
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS prayer_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  log_date DATE NOT NULL,
  fajr BOOLEAN NOT NULL DEFAULT false,
  dhuhr BOOLEAN NOT NULL DEFAULT false,
  asr BOOLEAN NOT NULL DEFAULT false,
  maghrib BOOLEAN NOT NULL DEFAULT false,
  isha BOOLEAN NOT NULL DEFAULT false,
  fajr_sunnah BOOLEAN NOT NULL DEFAULT false,
  dhuhr_sunnah BOOLEAN NOT NULL DEFAULT false,
  asr_sunnah BOOLEAN NOT NULL DEFAULT false,
  maghrib_sunnah BOOLEAN NOT NULL DEFAULT false,
  isha_sunnah BOOLEAN NOT NULL DEFAULT false,
  quran_pages INTEGER NOT NULL DEFAULT 0,
  quran_notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, log_date)
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_prayer_logs_user_date ON prayer_logs(user_id, log_date DESC);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_prayer_logs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_prayer_logs_updated ON prayer_logs;
CREATE TRIGGER on_prayer_logs_updated
  BEFORE UPDATE ON prayer_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_prayer_logs_updated_at();

-- RLS: Users can only see their own prayer logs
ALTER TABLE prayer_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own prayer logs"
  ON prayer_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own prayer logs"
  ON prayer_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own prayer logs"
  ON prayer_logs FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own prayer logs"
  ON prayer_logs FOR DELETE
  USING (auth.uid() = user_id);

-- Add adhan_enabled to user_settings if column doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_settings' AND column_name = 'adhan_enabled'
  ) THEN
    ALTER TABLE user_settings ADD COLUMN adhan_enabled BOOLEAN NOT NULL DEFAULT true;
  END IF;
END $$;
