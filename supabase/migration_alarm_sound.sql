-- Migration: Add alarm_sound and custom_alarm_data to user_settings
-- Run this in Supabase SQL Editor

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_settings' AND column_name = 'alarm_sound'
  ) THEN
    ALTER TABLE user_settings ADD COLUMN alarm_sound TEXT NOT NULL DEFAULT 'bell';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_settings' AND column_name = 'custom_alarm_data'
  ) THEN
    ALTER TABLE user_settings ADD COLUMN custom_alarm_data TEXT NOT NULL DEFAULT '';
  END IF;
END $$;

-- Add comment for documentation
COMMENT ON COLUMN user_settings.alarm_sound IS 'Alarm sound preset: bell, chime, adhan, soft, beep, nagham, custom';
COMMENT ON COLUMN user_settings.custom_alarm_data IS 'Base64 encoded custom alarm sound data URL';
