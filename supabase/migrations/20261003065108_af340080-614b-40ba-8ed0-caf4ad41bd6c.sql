ALTER TABLE public.collaboration_tasks
  ADD COLUMN priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('urgent','high','medium','low')),
  ADD COLUMN due_date date,
  ADD COLUMN notes text NOT NULL DEFAULT '',
  ADD COLUMN ai_employee_id text CHECK (ai_employee_id IS NULL OR ai_employee_id IN ('sonny','eva','sam','nour','dana','adam')),
  ADD COLUMN ai_output text,
  ADD COLUMN ai_status text NOT NULL DEFAULT 'idle' CHECK (ai_status IN ('idle','running','done','failed')),
  ADD COLUMN source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','chat','ai'));

CREATE OR REPLACE FUNCTION private.is_workspace_admin(_workspace_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.workspace_members m WHERE m.workspace_id = _workspace_id AND m.user_id = auth.uid() AND m.role = 'admin')
$$;
REVOKE ALL ON FUNCTION private.is_workspace_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.is_workspace_admin(uuid) TO authenticated;

DROP POLICY IF EXISTS "owner creates projects" ON public.collaboration_projects;
CREATE POLICY "owner or admin creates projects" ON public.collaboration_projects FOR INSERT TO authenticated WITH CHECK ((public.owns_workspace(workspace_id) OR private.is_workspace_admin(workspace_id)) AND created_by = auth.uid());
DROP POLICY IF EXISTS "owner edits projects" ON public.collaboration_projects;
CREATE POLICY "owner or admin edits projects" ON public.collaboration_projects FOR UPDATE TO authenticated USING (public.owns_workspace(workspace_id) OR private.is_workspace_admin(workspace_id)) WITH CHECK (public.owns_workspace(workspace_id) OR private.is_workspace_admin(workspace_id));

CREATE POLICY "member leaves workspace" ON public.workspace_members FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE TABLE public.collaboration_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.collaboration_projects(id) ON DELETE CASCADE,
  task_id uuid REFERENCES public.collaboration_tasks(id) ON DELETE SET NULL,
  actor_id uuid,
  employee_id text,
  kind text NOT NULL,
  summary text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX collaboration_activity_ws_idx ON public.collaboration_activity (workspace_id, created_at DESC);
GRANT SELECT ON public.collaboration_activity TO authenticated;
GRANT ALL ON public.collaboration_activity TO service_role;
ALTER TABLE public.collaboration_activity ENABLE ROW LEVEL SECURITY;
CREATE POLICY "team views activity" ON public.collaboration_activity FOR SELECT TO authenticated USING (public.owns_workspace(workspace_id) OR private.is_workspace_member(workspace_id));

CREATE OR REPLACE FUNCTION private.log_collaboration_activity() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _ws uuid; _proj uuid; _task uuid; _kind text; _summary text; _emp text;
BEGIN
  IF TG_TABLE_NAME = 'collaboration_projects' THEN
    _ws := NEW.workspace_id; _proj := NEW.id;
    IF TG_OP = 'INSERT' THEN _kind := 'project_created'; _summary := NEW.name;
    ELSIF NEW.status IS DISTINCT FROM OLD.status THEN _kind := 'project_' || NEW.status; _summary := NEW.name;
    ELSE RETURN NEW; END IF;
  ELSE
    _ws := NEW.workspace_id; _proj := NEW.project_id; _task := NEW.id; _emp := NEW.ai_employee_id;
    IF TG_OP = 'INSERT' THEN _kind := CASE WHEN NEW.source = 'chat' THEN 'output_shared' ELSE 'task_created' END; _summary := NEW.title;
    ELSIF NEW.ai_status IS DISTINCT FROM OLD.ai_status AND NEW.ai_status = 'done' THEN _kind := 'ai_done'; _summary := NEW.title;
    ELSIF NEW.ai_employee_id IS DISTINCT FROM OLD.ai_employee_id AND NEW.ai_employee_id IS NOT NULL THEN _kind := 'ai_assigned'; _summary := NEW.title;
    ELSIF NEW.status IS DISTINCT FROM OLD.status THEN _kind := 'task_' || NEW.status; _summary := NEW.title;
    ELSE RETURN NEW; END IF;
  END IF;
  INSERT INTO public.collaboration_activity (workspace_id, project_id, task_id, actor_id, employee_id, kind, summary)
  VALUES (_ws, _proj, _task, auth.uid(), _emp, _kind, left(_summary, 200));
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.log_collaboration_activity() FROM PUBLIC, anon;

CREATE TRIGGER log_project_activity AFTER INSERT OR UPDATE ON public.collaboration_projects FOR EACH ROW EXECUTE FUNCTION private.log_collaboration_activity();
CREATE TRIGGER log_task_activity AFTER INSERT OR UPDATE ON public.collaboration_tasks FOR EACH ROW EXECUTE FUNCTION private.log_collaboration_activity();