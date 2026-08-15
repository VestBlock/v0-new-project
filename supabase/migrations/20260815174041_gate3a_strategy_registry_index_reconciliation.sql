-- Gate 3A advisor reconciliation for the remaining uncovered foreign keys.
-- Index-only change; no strategy state or sending control is modified.

CREATE INDEX IF NOT EXISTS command_center_strategy_runs_job_idx
  ON public.command_center_strategy_runs(job_id)
  WHERE job_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS strategy_updates_run_idx
  ON public.strategy_updates(run_id)
  WHERE run_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS strategy_lane_versions_supersedes_lane_idx
  ON public.strategy_lane_versions(supersedes_id, lane_key)
  WHERE supersedes_id IS NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.operating_strategy_versions
    WHERE status = 'active'
       OR external_send_cap <> 0
       OR execution_mode IN ('internal_test', 'approved_live')
  ) THEN
    RAISE EXCEPTION 'Gate 3A index reconciliation must not activate operating strategies or sending.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.orchestration_controls
    WHERE integration_key = 'n8n' AND live_send_enabled
  ) THEN
    RAISE EXCEPTION 'Gate 3A requires n8n live sending to remain disabled.';
  END IF;
END;
$$;
