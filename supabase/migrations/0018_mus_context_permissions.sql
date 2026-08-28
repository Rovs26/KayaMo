-- Stored data is not automatically available to Mus. Each supported context
-- domain is an explicit, owner-scoped, server-enforced read grant.

create table public.mus_context_permissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  domain text not null,
  allowed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null,
  server_updated_at timestamptz not null default now(),
  constraint mus_context_permissions_domain_check
    check (domain in ('goals_planning', 'physical_self', 'memory', 'faith'))
);

create unique index mus_context_permissions_user_domain_uidx
  on public.mus_context_permissions (user_id, domain);

create index mus_context_permissions_server_updated_at_idx
  on public.mus_context_permissions (server_updated_at);

create trigger mus_context_permissions_touch
  before insert or update on public.mus_context_permissions
  for each row execute function public.kayamo_touch_row();

alter table public.mus_context_permissions enable row level security;

create policy mus_context_permissions_select
  on public.mus_context_permissions for select to authenticated
  using (user_id = auth.uid());

create policy mus_context_permissions_insert
  on public.mus_context_permissions for insert to authenticated
  with check (user_id = auth.uid());

create policy mus_context_permissions_update
  on public.mus_context_permissions for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

revoke all on public.mus_context_permissions from public, anon, authenticated;
grant select, insert, update on public.mus_context_permissions to authenticated;
grant all on public.mus_context_permissions to service_role;
