-- Bundle 2 governed Coco storage. Private diary, vent, and prayer-journal
-- entries are intentionally absent: they remain device-only.

alter table public.agent_runs
  add column request_id text,
  add column status text,
  add column error_code text,
  add column logical_date date;

alter table public.agent_runs
  alter column input set default '{}'::jsonb,
  alter column output set default '{}'::jsonb;

-- Legacy runs predate the content-free telemetry contract. Remove their payloads
-- before validating the database-level constraint.
update public.agent_runs
set input = '{}'::jsonb,
    output = '{}'::jsonb,
    scrubbed_at = coalesce(scrubbed_at, now())
where input <> '{}'::jsonb or output <> '{}'::jsonb;

alter table public.agent_runs
  add constraint agent_runs_status_check
    check (status is null or status in ('model', 'fallback', 'safety', 'budget')),
  add constraint agent_runs_content_free_check
    check (input = '{}'::jsonb and output = '{}'::jsonb);

create index agent_runs_user_request_id_idx
  on public.agent_runs (user_id, request_id);
create index agent_runs_user_logical_date_idx
  on public.agent_runs (user_id, logical_date);

alter table public.agent_memory
  alter column embedding_model set default 'none',
  add column explicit boolean not null default false,
  add column deleted_at timestamptz;

-- Pre-Bundle-2 memories cannot prove that the user pressed Remember this. Keep
-- them out of reads and sync by converting them to recoverable tombstones.
update public.agent_memory
set deleted_at = coalesce(deleted_at, now())
where explicit = false;

alter table public.agent_memory
  alter column explicit set default true,
  add constraint agent_memory_explicit_check
    check (explicit = true or deleted_at is not null);

create index agent_memory_server_updated_at_idx
  on public.agent_memory (server_updated_at);

create trigger agent_memory_preserve_tombstone before update on public.agent_memory
  for each row execute function public.kayamo_preserve_tombstone();

drop policy if exists agent_memory_select on public.agent_memory;
drop policy if exists agent_memory_insert on public.agent_memory;
drop policy if exists agent_memory_update on public.agent_memory;
drop policy if exists agent_memory_delete on public.agent_memory;

create policy agent_memory_select on public.agent_memory for select to authenticated
  using (user_id = auth.uid() and explicit = true and deleted_at is null);
create policy agent_memory_insert on public.agent_memory for insert to authenticated
  with check (user_id = auth.uid() and explicit = true);
create policy agent_memory_update on public.agent_memory for update to authenticated
  using (user_id = auth.uid() and explicit = true and deleted_at is null)
  with check (user_id = auth.uid() and explicit = true);

create table public.coco_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null,
  server_updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint coco_conversations_title_len check (
    title is null or char_length(trim(title)) between 1 and 120
  )
);

create table public.coco_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  conversation_id uuid not null references public.coco_conversations (id) on delete restrict,
  role text not null,
  content text not null,
  response_source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null,
  server_updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint coco_messages_role_check check (role in ('user', 'assistant')),
  constraint coco_messages_content_len check (char_length(content) between 1 and 5000),
  constraint coco_messages_response_source_check check (
    response_source is null
    or response_source in ('model', 'fallback', 'safety', 'budget')
  )
);

create index coco_conversations_user_updated_at_idx
  on public.coco_conversations (user_id, updated_at desc);
create index coco_conversations_server_updated_at_idx
  on public.coco_conversations (server_updated_at);
create index coco_messages_conversation_created_at_idx
  on public.coco_messages (conversation_id, created_at);
create index coco_messages_server_updated_at_idx
  on public.coco_messages (server_updated_at);

create trigger coco_conversations_touch before insert or update on public.coco_conversations
  for each row execute function public.kayamo_touch_row();
create trigger coco_messages_touch before insert or update on public.coco_messages
  for each row execute function public.kayamo_touch_row();
create trigger coco_conversations_preserve_tombstone before update on public.coco_conversations
  for each row execute function public.kayamo_preserve_tombstone();
create trigger coco_messages_preserve_tombstone before update on public.coco_messages
  for each row execute function public.kayamo_preserve_tombstone();

alter table public.coco_conversations enable row level security;
alter table public.coco_messages enable row level security;

create policy coco_conversations_select on public.coco_conversations
  for select to authenticated
  using (user_id = auth.uid() and deleted_at is null);
create policy coco_conversations_insert on public.coco_conversations
  for insert to authenticated
  with check (user_id = auth.uid());
create policy coco_conversations_update on public.coco_conversations
  for update to authenticated
  using (user_id = auth.uid() and deleted_at is null)
  with check (user_id = auth.uid());

create policy coco_messages_select on public.coco_messages
  for select to authenticated
  using (
    user_id = auth.uid()
    and deleted_at is null
    and exists (
      select 1 from public.coco_conversations c
      where c.id = coco_messages.conversation_id
        and c.user_id = auth.uid()
        and c.deleted_at is null
    )
  );
create policy coco_messages_insert on public.coco_messages
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.coco_conversations c
      where c.id = coco_messages.conversation_id
        and c.user_id = auth.uid()
        and c.deleted_at is null
    )
  );
create policy coco_messages_update on public.coco_messages
  for update to authenticated
  using (
    user_id = auth.uid()
    and deleted_at is null
    and exists (
      select 1 from public.coco_conversations c
      where c.id = coco_messages.conversation_id
        and c.user_id = auth.uid()
        and c.deleted_at is null
    )
  )
  with check (user_id = auth.uid());

revoke all on public.coco_conversations, public.coco_messages from public, anon;
grant select, insert, update on public.coco_conversations, public.coco_messages
  to authenticated;
grant all on public.coco_conversations, public.coco_messages to service_role;

revoke delete on public.agent_memory, public.coco_conversations, public.coco_messages
  from authenticated;
