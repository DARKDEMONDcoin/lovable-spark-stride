DROP POLICY "Users submit their own product feedback" ON public.product_feedback;
CREATE POLICY "Users submit their own product feedback"
ON public.product_feedback FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND (
    workspace_id IS NULL
    OR public.owns_workspace(workspace_id)
    OR EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = product_feedback.workspace_id
      AND wm.user_id = auth.uid()
    )
  )
);

DROP POLICY "Users create their own support requests" ON public.support_requests;
CREATE POLICY "Users create their own support requests"
ON public.support_requests FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND (
    workspace_id IS NULL
    OR public.owns_workspace(workspace_id)
    OR EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = support_requests.workspace_id
      AND wm.user_id = auth.uid()
    )
  )
);