-- ============================================================================
-- Sabeel additive migration: reconcile goals.project_id
-- ============================================================================
-- MANUAL REVIEW REQUIRED. Do not run automatically and do not run
-- supabase/schema.sql before this migration. Back up the Supabase project and
-- compare the live schema with this file before applying it.
--
-- This migration is intentionally limited to the project_id field used by the
-- Goal TypeScript model and API. It does not delete, rewrite, or backfill rows.
-- It supersedes the earlier version of this file, which incorrectly referenced
-- a nonexistent goals.duration column.
-- ============================================================================

BEGIN;

-- Existing installations may already have this column. In that case this is a
-- no-op and does not change its type, values, or constraints.
ALTER TABLE public.goals
  ADD COLUMN IF NOT EXISTS project_id UUID
  REFERENCES public.projects(id) ON DELETE SET NULL;

-- Support goal filtering and joins by project without changing existing data.
CREATE INDEX IF NOT EXISTS idx_goals_project_id
  ON public.goals(project_id);

-- No new goal constraints are added here. The repository model has no duration
-- field, and production constraints must not be assumed from the bootstrap SQL.

COMMIT;
