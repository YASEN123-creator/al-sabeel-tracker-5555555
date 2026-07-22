-- SAFE ADDITIVE MIGRATION — MANUAL REVIEW REQUIRED.
--
-- Adds optional fields used by Sabeel's general (non-time-based) goals.
-- This file does not drop, rename, recreate, or transform any existing data.
-- Do not run automatically and never run supabase/schema.sql before it.
-- Create a verified backup and compare these columns with the live schema first.

BEGIN;

ALTER TABLE public.goals
  ADD COLUMN IF NOT EXISTS goal_kind text NOT NULL DEFAULT 'metric',
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS target_date date,
  ADD COLUMN IF NOT EXISTS is_completed boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.goals.goal_kind IS
  'Application discriminator: metric for existing calculated goals, general for goals not tied to time or task totals.';
COMMENT ON COLUMN public.goals.title IS
  'Optional title used by general goals.';
COMMENT ON COLUMN public.goals.description IS
  'Optional description used by general goals.';
COMMENT ON COLUMN public.goals.target_date IS
  'Optional local calendar target date for a general goal.';
COMMENT ON COLUMN public.goals.is_completed IS
  'Manual completion state for general goals.';

COMMIT;

