create extension if not exists vector with schema extensions;

create table public.knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  source text not null,
  title text,
  position integer not null default 0,
  content text not null,
  embedding extensions.vector(3072) not null,
  created_at timestamptz not null default now()
);

grant select, insert, delete on public.knowledge_chunks to authenticated;
grant all on public.knowledge_chunks to service_role;

alter table public.knowledge_chunks enable row level security;

create policy "Owners manage their knowledge" on public.knowledge_chunks
  for all to authenticated
  using (public.owns_workspace(workspace_id))
  with check (public.owns_workspace(workspace_id));

create index knowledge_chunks_ws_idx on public.knowledge_chunks (workspace_id, source);
create index knowledge_chunks_embedding_idx on public.knowledge_chunks
  using hnsw ((embedding::extensions.halfvec(3072)) extensions.halfvec_cosine_ops);

create or replace function public.match_knowledge(_workspace_id uuid, _query extensions.vector(3072), _count int default 6)
returns table (id uuid, source text, title text, content text, similarity float)
language sql stable
set search_path = public, extensions
as $$
  select k.id, k.source, k.title, k.content,
         1 - (k.embedding::halfvec(3072) <=> _query::halfvec(3072)) as similarity
  from public.knowledge_chunks k
  where k.workspace_id = _workspace_id
  order by k.embedding::halfvec(3072) <=> _query::halfvec(3072)
  limit least(greatest(_count, 1), 20);
$$;

grant execute on function public.match_knowledge(uuid, extensions.vector, int) to authenticated, service_role;