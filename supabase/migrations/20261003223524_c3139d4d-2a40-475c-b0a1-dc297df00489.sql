CREATE TABLE public.product_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE SET NULL,
  kind text NOT NULL,
  rating smallint NOT NULL,
  message text NOT NULL,
  page_path text,
  status text NOT NULL DEFAULT 'new',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT product_feedback_kind_valid CHECK (kind IN ('idea','improvement','issue','praise')),
  CONSTRAINT product_feedback_rating_valid CHECK (rating BETWEEN 1 AND 5),
  CONSTRAINT product_feedback_message_length CHECK (char_length(message) BETWEEN 10 AND 4000),
  CONSTRAINT product_feedback_status_valid CHECK (status IN ('new','reviewing','planned','resolved','closed'))
);

GRANT SELECT, INSERT ON public.product_feedback TO authenticated;
GRANT ALL ON public.product_feedback TO service_role;

ALTER TABLE public.product_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view their own product feedback"
ON public.product_feedback FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users submit their own product feedback"
ON public.product_feedback FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND (
    workspace_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = product_feedback.workspace_id
      AND wm.user_id = auth.uid()
    )
  )
);

CREATE TRIGGER product_feedback_set_updated_at
BEFORE UPDATE ON public.product_feedback
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX product_feedback_user_created_idx ON public.product_feedback(user_id, created_at DESC);
CREATE INDEX product_feedback_status_created_idx ON public.product_feedback(status, created_at DESC);

CREATE TABLE public.support_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE SET NULL,
  subject text NOT NULL,
  priority text NOT NULL DEFAULT 'normal',
  message text NOT NULL,
  page_path text,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT support_requests_subject_length CHECK (char_length(subject) BETWEEN 3 AND 140),
  CONSTRAINT support_requests_message_length CHECK (char_length(message) BETWEEN 10 AND 5000),
  CONSTRAINT support_requests_priority_valid CHECK (priority IN ('low','normal','high','urgent')),
  CONSTRAINT support_requests_status_valid CHECK (status IN ('open','in_progress','waiting_user','resolved','closed'))
);

GRANT SELECT, INSERT ON public.support_requests TO authenticated;
GRANT ALL ON public.support_requests TO service_role;

ALTER TABLE public.support_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view their own support requests"
ON public.support_requests FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users create their own support requests"
ON public.support_requests FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND (
    workspace_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = support_requests.workspace_id
      AND wm.user_id = auth.uid()
    )
  )
);

CREATE TRIGGER support_requests_set_updated_at
BEFORE UPDATE ON public.support_requests
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX support_requests_user_created_idx ON public.support_requests(user_id, created_at DESC);
CREATE INDEX support_requests_status_priority_idx ON public.support_requests(status, priority, created_at DESC);