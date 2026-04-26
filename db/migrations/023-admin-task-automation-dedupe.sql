-- Prevent duplicate open workflow tasks for the same related entity.
-- Keeps the admin queue useful when uploads or failure alerts are retried.

CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_tasks_open_entity_dedupe
  ON admin_tasks(task_type, entity_type, entity_id)
  WHERE entity_type IS NOT NULL
    AND entity_id IS NOT NULL
    AND status IN ('open', 'in_progress', 'waiting');
