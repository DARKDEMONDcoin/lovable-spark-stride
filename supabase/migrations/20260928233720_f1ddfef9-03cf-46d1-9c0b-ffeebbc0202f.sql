ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS pending_action jsonb;

CREATE INDEX IF NOT EXISTS messages_task_id_idx ON public.messages(task_id) WHERE task_id IS NOT NULL;

UPDATE public.messages AS m
SET task_id = r.task_id
FROM public.employee_runs AS r
WHERE r.message_id = m.id
  AND r.task_id IS NOT NULL
  AND m.task_id IS NULL;