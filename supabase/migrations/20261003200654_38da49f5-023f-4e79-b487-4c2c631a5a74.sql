DROP FUNCTION IF EXISTS public.transfer_project_ownership(uuid, uuid);
CREATE OR REPLACE FUNCTION public.transfer_project_ownership(_workspace_id uuid, _caller uuid, _new_owner uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE old_owner uuid;
BEGIN
  SELECT owner_id INTO old_owner FROM public.workspaces WHERE id = _workspace_id AND kind = 'project';
  IF old_owner IS NULL OR old_owner <> _caller THEN RAISE EXCEPTION 'Not the project owner'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.workspace_members WHERE workspace_id = _workspace_id AND user_id = _new_owner) THEN
    RAISE EXCEPTION 'New owner must be a member';
  END IF;
  DELETE FROM public.workspace_members WHERE workspace_id = _workspace_id AND user_id = _new_owner;
  UPDATE public.workspaces SET owner_id = _new_owner WHERE id = _workspace_id;
  INSERT INTO public.workspace_members (workspace_id, user_id, role) VALUES (_workspace_id, old_owner, 'admin') ON CONFLICT DO NOTHING;
  INSERT INTO public.user_notifications (user_id, kind, title, body, workspace_id)
    VALUES (_new_owner, 'role_changed', 'بقيت مالك المشروع', 'اتنقلت لك ملكية المشروع وكل صلاحياته', _workspace_id);
END $$;
REVOKE ALL ON FUNCTION public.transfer_project_ownership(uuid, uuid, uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.transfer_project_ownership(uuid, uuid, uuid) TO service_role;