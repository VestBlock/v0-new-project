-- This script should be run after both analysis_jobs and analysis_results tables are created.
-- It adds the foreign key constraint from analysis_jobs.result_id to analysis_results.id.

ALTER TABLE public.analysis_jobs
ADD CONSTRAINT fk_analysis_jobs_result_id
FOREIGN KEY (result_id)
REFERENCES public.analysis_results(id)
ON DELETE SET NULL; -- Or ON DELETE RESTRICT if a result should not be deleted if a job points to it.
