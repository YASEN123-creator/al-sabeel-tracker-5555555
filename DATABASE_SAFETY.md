# Database safety

Sabeel uses Supabase PostgreSQL. Database changes are manual operations: this
repository must not automatically execute SQL against a Supabase project.

## Destructive bootstrap

`supabase/schema.sql` is a destructive bootstrap/reset script for an empty,
disposable local or development database. It drops and recreates application
tables and will delete existing Sabeel data.

Never run `supabase/schema.sql` against production, staging, or any database
containing data that must be preserved. It is not a migration.

`al-sabeel-complete.zip` is a historical source archive and may contain an older
copy of the destructive schema without these warnings. It is not an
authoritative database setup or migration source; use the reviewed working-tree
files only.

## Additive migrations prepared for current mismatches

- `supabase/migration_goals_project.sql` adds `goals.project_id` when missing and
  creates its index. It does not add the old invalid `duration` constraint.
- `supabase/migration_prayer_log_extended_fields.sql` adds the five prayer status
  fields, `quran_surahs`, and `custom_worships` required by the current
  TypeScript model and API.
- `supabase/migration_goals_general_fields.sql` adds the optional title,
  description, target date, completion state, and goal-kind fields used by
  general goals that are not tied to time. It does not replace the existing
  goal-type constraint or modify existing metric goal values.

These files are designed to be additive and idempotent where practical. That
does not prove they match the live production schema. Existing legacy migration
files in `supabase/` must also be treated as manually reviewed SQL; do not run
the directory as a batch and do not assume file-name order is a migration log.

## Required review order

1. Create and verify a current Supabase backup.
2. Inspect the live table and column definitions in read-only mode.
3. Compare the live schema with one migration file at a time.
4. Review the SQL manually, including data types, defaults, foreign keys, and
   index names.
5. Test the migration on a disposable non-production database when possible.
6. Apply only the migration statements confirmed to be missing.
7. Verify the resulting columns and test the affected application feature.
8. Record the applied file and date outside this repository or in the team's
   chosen migration history.

Do not prepend the destructive bootstrap. Do not use a command that applies all
SQL files automatically. Stop if the live schema differs from the assumptions
documented in a migration.

## Production preflight

Before applying any prepared migration, manually verify:

- `public.projects`, `public.goals`, and `public.prayer_logs` exist.
- `goals.project_id`, if present, is compatible with UUID project IDs.
- Prayer status columns, if present, are text-compatible.
- `quran_surahs`, if present, is compatible with `text[]`.
- `custom_worships`, if present, is compatible with `jsonb` arrays.
- General-goal columns, if already present, use compatible `text`, `date`, and
  `boolean` types. Existing rows must remain `goal_kind = 'metric'`.
- No migration statement would replace an existing column or constraint.

If a supposedly missing column already exists with a different type, do not
alter it automatically. Pause and reconcile the application expectation with
the live schema first.

No migration in this repository is authorization to modify production. A human
must review and apply each approved migration manually after a verified backup.
