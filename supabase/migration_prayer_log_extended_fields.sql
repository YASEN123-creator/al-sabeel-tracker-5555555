-- ============================================================================
-- Sabeel additive migration: prayer log status, Quran, and custom worship data
-- ============================================================================
-- MANUAL REVIEW REQUIRED. Do not run automatically and do not run
-- supabase/schema.sql before this migration. Back up the Supabase project and
-- compare the live schema with this file before applying it.
--
-- The PrayerLog TypeScript model and API already read and write these fields,
-- but the checked-in bootstrap and legacy prayer migration do not define them.
-- This migration only adds missing columns. It does not delete, rename,
-- transform, or overwrite existing columns or user rows.
-- ============================================================================

BEGIN;

-- Nullable text preserves the existing meaning of prayer status: older rows
-- have no detailed status until the user records one.
ALTER TABLE public.prayer_logs
  ADD COLUMN IF NOT EXISTS fajr_status TEXT,
  ADD COLUMN IF NOT EXISTS dhuhr_status TEXT,
  ADD COLUMN IF NOT EXISTS asr_status TEXT,
  ADD COLUMN IF NOT EXISTS maghrib_status TEXT,
  ADD COLUMN IF NOT EXISTS isha_status TEXT;

-- Existing rows receive empty collections, matching the application defaults.
-- text[] matches the string[] Quran-surah payload; jsonb preserves the structured
-- CustomWorship[] objects sent by the API.
ALTER TABLE public.prayer_logs
  ADD COLUMN IF NOT EXISTS quran_surahs TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS custom_worships JSONB NOT NULL DEFAULT '[]'::JSONB;

COMMENT ON COLUMN public.prayer_logs.fajr_status IS
  'Optional prayer status used by Sabeel: mosque, home, late, or missed.';
COMMENT ON COLUMN public.prayer_logs.dhuhr_status IS
  'Optional prayer status used by Sabeel: mosque, home, late, or missed.';
COMMENT ON COLUMN public.prayer_logs.asr_status IS
  'Optional prayer status used by Sabeel: mosque, home, late, or missed.';
COMMENT ON COLUMN public.prayer_logs.maghrib_status IS
  'Optional prayer status used by Sabeel: mosque, home, late, or missed.';
COMMENT ON COLUMN public.prayer_logs.isha_status IS
  'Optional prayer status used by Sabeel: mosque, home, late, or missed.';
COMMENT ON COLUMN public.prayer_logs.quran_surahs IS
  'Quran surah names recorded for this daily prayer log.';
COMMENT ON COLUMN public.prayer_logs.custom_worships IS
  'Structured Sabeel custom worship entries for this daily prayer log.';

COMMIT;
