CREATE TABLE public.workspace_members (
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('admin','member')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id,user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_members TO authenticated;
GRANT ALL ON public.workspace_members TO service_role;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "membership visible to owner and self" ON public.workspace_members FOR SELECT TO authenticated USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = workspace_id AND w.owner_id = auth.uid()));
CREATE POLICY "owner removes members" ON public.workspace_members FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = workspace_id AND w.owner_id = auth.uid()));
CREATE TRIGGER workspace_members_updated BEFORE UPDATE ON public.workspace_members FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.is_workspace_member(_workspace_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$ SELECT EXISTS (SELECT 1 FROM public.workspace_members m WHERE m.workspace_id = _workspace_id AND m.user_id = auth.uid()) $$;
REVOKE ALL ON FUNCTION public.is_workspace_member(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_workspace_member(uuid) TO authenticated;
CREATE POLICY "members view workspace identity" ON public.workspaces FOR SELECT TO authenticated USING (public.is_workspace_member(id));

CREATE TABLE public.workspace_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  email text NOT NULL CHECK (length(email) BETWEEN 3 AND 254),
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('admin','member')),
  token_hash text NOT NULL UNIQUE,
  invited_by uuid NOT NULL REFERENCES auth.users(id),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_invitations TO authenticated;
GRANT ALL ON public.workspace_invitations TO service_role;
ALTER TABLE public.workspace_invitations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner views invitations" ON public.workspace_invitations FOR SELECT TO authenticated USING (public.owns_workspace(workspace_id));
CREATE POLICY "owner creates invitations" ON public.workspace_invitations FOR INSERT TO authenticated WITH CHECK (public.owns_workspace(workspace_id) AND invited_by = auth.uid() AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at <= now() + interval '7 days' AND email = lower(btrim(email)));
CREATE POLICY "owner revokes invitations" ON public.workspace_invitations FOR UPDATE TO authenticated USING (public.owns_workspace(workspace_id)) WITH CHECK (public.owns_workspace(workspace_id));
CREATE TRIGGER workspace_invitations_updated BEFORE UPDATE ON public.workspace_invitations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.accept_workspace_invitation(_token_hash text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE invitation public.workspace_invitations%ROWTYPE; verified_email text;
BEGIN
  IF auth.uid() IS NULL OR length(_token_hash) <> 64 THEN RAISE EXCEPTION 'Invalid invitation'; END IF;
  SELECT lower(email) INTO verified_email FROM auth.users WHERE id = auth.uid() AND email_confirmed_at IS NOT NULL;
  IF verified_email IS NULL THEN RAISE EXCEPTION 'Confirm your email before joining'; END IF;
  SELECT * INTO invitation FROM public.workspace_invitations WHERE token_hash = _token_hash AND revoked_at IS NULL AND accepted_at IS NULL AND expires_at > now() FOR UPDATE;
  IF NOT FOUND OR invitation.email <> verified_email THEN RAISE EXCEPTION 'Invitation unavailable for this account'; END IF;
  IF EXISTS (SELECT 1 FROM public.workspaces WHERE id = invitation.workspace_id AND owner_id = auth.uid()) THEN RAISE EXCEPTION 'Already the owner'; END IF;
  INSERT INTO public.workspace_members (workspace_id,user_id,role) VALUES (invitation.workspace_id,auth.uid(),invitation.role)
    ON CONFLICT (workspace_id,user_id) DO NOTHING;
  UPDATE public.workspace_invitations SET accepted_at = now() WHERE id = invitation.id;
  RETURN invitation.workspace_id;
END $$;
REVOKE ALL ON FUNCTION public.accept_workspace_invitation(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_workspace_invitation(text) TO authenticated;

CREATE TABLE public.collaboration_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 2 AND 120),
  description text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','paused')),
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id,workspace_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.collaboration_projects TO authenticated;
GRANT ALL ON public.collaboration_projects TO service_role;
ALTER TABLE public.collaboration_projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "team views projects" ON public.collaboration_projects FOR SELECT TO authenticated USING (public.owns_workspace(workspace_id) OR public.is_workspace_member(workspace_id));
CREATE POLICY "owner creates projects" ON public.collaboration_projects FOR INSERT TO authenticated WITH CHECK (public.owns_workspace(workspace_id) AND created_by = auth.uid());
CREATE POLICY "owner edits projects" ON public.collaboration_projects FOR UPDATE TO authenticated USING (public.owns_workspace(workspace_id)) WITH CHECK (public.owns_workspace(workspace_id));
CREATE POLICY "owner deletes projects" ON public.collaboration_projects FOR DELETE TO authenticated USING (public.owns_workspace(workspace_id));
CREATE TRIGGER collaboration_projects_updated BEFORE UPDATE ON public.collaboration_projects FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.collaboration_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  workspace_id uuid NOT NULL,
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 2 AND 200),
  details text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'todo' CHECK (status IN ('todo','in_progress','done')),
  assignee_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (project_id,workspace_id) REFERENCES public.collaboration_projects(id,workspace_id) ON DELETE CASCADE
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.collaboration_tasks TO authenticated;
GRANT ALL ON public.collaboration_tasks TO service_role;
ALTER TABLE public.collaboration_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "team views collaboration tasks" ON public.collaboration_tasks FOR SELECT TO authenticated USING (public.owns_workspace(workspace_id) OR public.is_workspace_member(workspace_id));
CREATE POLICY "team creates collaboration tasks" ON public.collaboration_tasks FOR INSERT TO authenticated WITH CHECK ((public.owns_workspace(workspace_id) OR public.is_workspace_member(workspace_id)) AND created_by = auth.uid() AND (assignee_id IS NULL OR assignee_id = (SELECT owner_id FROM public.workspaces WHERE id = workspace_id) OR EXISTS (SELECT 1 FROM public.workspace_members WHERE workspace_id = collaboration_tasks.workspace_id AND user_id = assignee_id)));
CREATE POLICY "team edits collaboration tasks" ON public.collaboration_tasks FOR UPDATE TO authenticated USING (public.owns_workspace(workspace_id) OR public.is_workspace_member(workspace_id)) WITH CHECK ((public.owns_workspace(workspace_id) OR public.is_workspace_member(workspace_id)) AND (assignee_id IS NULL OR assignee_id = (SELECT owner_id FROM public.workspaces WHERE id = workspace_id) OR EXISTS (SELECT 1 FROM public.workspace_members WHERE workspace_id = collaboration_tasks.workspace_id AND user_id = assignee_id)));
CREATE POLICY "owner or author deletes collaboration tasks" ON public.collaboration_tasks FOR DELETE TO authenticated USING (public.owns_workspace(workspace_id) OR (public.is_workspace_member(workspace_id) AND created_by = auth.uid()));
CREATE TRIGGER collaboration_tasks_updated BEFORE UPDATE ON public.collaboration_tasks FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();