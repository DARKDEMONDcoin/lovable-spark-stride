alter table public.collaboration_projects drop constraint collaboration_projects_status_check;
alter table public.collaboration_projects add constraint collaboration_projects_status_check check (status = any (array['active','completed','paused','archived']));

create table public.collaboration_comments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  task_id uuid not null references public.collaboration_tasks(id) on delete cascade,
  author_id uuid not null default auth.uid(),
  body text not null check (length(btrim(body)) between 1 and 4000),
  mentions uuid[] not null default '{}',
  created_at timestamptz not null default now()
);
grant select, insert, delete on public.collaboration_comments to authenticated;
grant all on public.collaboration_comments to service_role;
alter table public.collaboration_comments enable row level security;
create policy "team reads comments" on public.collaboration_comments for select to authenticated using (owns_workspace(workspace_id) or private.is_workspace_member(workspace_id));
create policy "team writes comments" on public.collaboration_comments for insert to authenticated with check ((owns_workspace(workspace_id) or private.is_workspace_member(workspace_id)) and author_id = auth.uid() and exists (select 1 from public.collaboration_tasks t where t.id = task_id and t.workspace_id = collaboration_comments.workspace_id));
create policy "author deletes comment" on public.collaboration_comments for delete to authenticated using (author_id = auth.uid() or owns_workspace(workspace_id));
create index on public.collaboration_comments(task_id, created_at);

create or replace function private.notify_user(_user uuid, _ws uuid, _kind text, _title text, _body text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if _user is null or _user = auth.uid() then return; end if;
  insert into public.user_notifications(user_id, workspace_id, kind, title, body) values (_user, _ws, _kind, left(_title,200), left(coalesce(_body,''),500));
end $$;

create or replace function private.collab_task_notify() returns trigger
language plpgsql security definer set search_path = public as $$
declare actor text;
begin
  select coalesce(full_name,'زميل') into actor from public.profiles where id = auth.uid();
  if new.assignee_id is not null and (tg_op = 'INSERT' or new.assignee_id is distinct from old.assignee_id) then
    perform private.notify_user(new.assignee_id, new.workspace_id, 'task_assigned', 'أُسندت إليك مهمة', coalesce(actor,'زميل') || ' أسند إليك «' || new.title || '»');
  end if;
  if tg_op = 'UPDATE' and new.ai_status = 'done' and old.ai_status is distinct from 'done' then
    perform private.notify_user(new.created_by, new.workspace_id, 'ai_done', 'النتيجة جاهزة', 'أنجز الموظف الرقمي «' || new.title || '»');
    if new.assignee_id is distinct from new.created_by then perform private.notify_user(new.assignee_id, new.workspace_id, 'ai_done', 'النتيجة جاهزة', 'أنجز الموظف الرقمي «' || new.title || '»'); end if;
  end if;
  if tg_op = 'UPDATE' and new.status = 'done' and old.status <> 'done' then
    perform private.notify_user(new.created_by, new.workspace_id, 'task_done', 'اكتملت مهمة', coalesce(actor,'زميل') || ' أكمل «' || new.title || '»');
  end if;
  return new;
end $$;
create trigger collab_task_notify after insert or update on public.collaboration_tasks for each row execute function private.collab_task_notify();

create or replace function private.collab_comment_notify() returns trigger
language plpgsql security definer set search_path = public as $$
declare t record; actor text; u uuid;
begin
  select * into t from public.collaboration_tasks where id = new.task_id;
  select coalesce(full_name,'زميل') into actor from public.profiles where id = new.author_id;
  foreach u in array new.mentions loop
    if private.is_workspace_member(new.workspace_id, u) or u = (select owner_id from public.workspaces where id = new.workspace_id) then
      perform private.notify_user(u, new.workspace_id, 'mention', 'أشار إليك ' || coalesce(actor,'زميل'), '«' || t.title || '»: ' || new.body);
    end if;
  end loop;
  if not (t.assignee_id = any(new.mentions)) then perform private.notify_user(t.assignee_id, new.workspace_id, 'comment', 'تعليق جديد', coalesce(actor,'زميل') || ' على «' || t.title || '»: ' || new.body); end if;
  if t.created_by is distinct from t.assignee_id and not (t.created_by = any(new.mentions)) then perform private.notify_user(t.created_by, new.workspace_id, 'comment', 'تعليق جديد', coalesce(actor,'زميل') || ' على «' || t.title || '»: ' || new.body); end if;
  return new;
end $$;
create trigger collab_comment_notify after insert on public.collaboration_comments for each row execute function private.collab_comment_notify();

create or replace function private.close_member_invites() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.workspace_invitations i set revoked_at = now()
  from auth.users u where u.id = new.user_id and lower(i.email) = lower(u.email)
    and i.workspace_id = new.workspace_id and i.accepted_at is null and i.revoked_at is null;
  return new;
end $$;
create trigger close_member_invites after insert on public.workspace_members for each row execute function private.close_member_invites();

update public.workspace_invitations i set revoked_at = now()
from public.workspace_members m join auth.users u on u.id = m.user_id
where m.workspace_id = i.workspace_id and lower(u.email) = lower(i.email) and i.accepted_at is null and i.revoked_at is null;
update public.workspace_invitations set revoked_at = now() where email ilike 'newmember.test%' and revoked_at is null;