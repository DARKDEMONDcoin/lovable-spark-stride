CREATE TABLE public.collaboration_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.collaboration_tasks(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL,
  uploaded_by uuid NOT NULL,
  name text NOT NULL,
  path text NOT NULL,
  size bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.collaboration_attachments TO authenticated;
GRANT ALL ON public.collaboration_attachments TO service_role;
ALTER TABLE public.collaboration_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read attachments" ON public.collaboration_attachments FOR SELECT TO authenticated USING (private.is_workspace_member(workspace_id, auth.uid()));
CREATE POLICY "members add attachments" ON public.collaboration_attachments FOR INSERT TO authenticated WITH CHECK (uploaded_by = auth.uid() AND private.is_workspace_member(workspace_id, auth.uid()));
CREATE POLICY "uploader deletes attachments" ON public.collaboration_attachments FOR DELETE TO authenticated USING (uploaded_by = auth.uid() AND private.is_workspace_member(workspace_id, auth.uid()));
CREATE INDEX collaboration_attachments_task_idx ON public.collaboration_attachments(task_id);

CREATE POLICY "members read collab files" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'collab-files' AND private.is_workspace_member(((storage.foldername(name))[1])::uuid, auth.uid()));
CREATE POLICY "members upload collab files" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'collab-files' AND private.is_workspace_member(((storage.foldername(name))[1])::uuid, auth.uid()));
CREATE POLICY "owners delete collab files" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'collab-files' AND owner = auth.uid());