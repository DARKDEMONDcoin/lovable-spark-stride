ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS sender_id uuid, ADD COLUMN IF NOT EXISTS sender_name text;

CREATE POLICY "team reads shared conversations" ON public.conversations FOR SELECT TO authenticated USING (private.is_workspace_member(workspace_id, auth.uid()));
CREATE POLICY "team creates shared conversations" ON public.conversations FOR INSERT TO authenticated WITH CHECK (private.is_workspace_member(workspace_id, auth.uid()));
CREATE POLICY "team marks shared conversations read" ON public.conversations FOR UPDATE TO authenticated USING (private.is_workspace_member(workspace_id, auth.uid())) WITH CHECK (private.is_workspace_member(workspace_id, auth.uid()));
CREATE POLICY "team reads shared messages" ON public.messages FOR SELECT TO authenticated USING (private.is_workspace_member(workspace_id, auth.uid()));