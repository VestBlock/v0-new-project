-- Gate 3C follow-up: remove two redundant partial indexes reported by the
-- Supabase performance advisor. Gate 3A already created the exact canonical
-- indexes, so retaining the Gate 3C copies would add write overhead without
-- changing query coverage.

DO $gate3c_index_preconditions$
BEGIN
  IF to_regclass('public.command_center_strategy_runs_operating_version_idx') IS NULL THEN
    RAISE EXCEPTION 'Canonical command-center operating-version index is missing.';
  END IF;

  IF to_regclass('public.strategy_lead_memberships_operating_version_idx') IS NULL THEN
    RAISE EXCEPTION 'Canonical membership operating-version index is missing.';
  END IF;
END
$gate3c_index_preconditions$;

DROP INDEX IF EXISTS public.command_center_strategy_runs_gate3c_version_idx;
DROP INDEX IF EXISTS public.strategy_lead_memberships_gate3c_version_idx;
