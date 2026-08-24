-- Phase 0 identity, Life Inbox, and Released goals.
-- Storage does not imply Mus may read; inbox defaults to mus_may_read = false.

alter table public.goals drop constraint if exists goals_status_check;
alter table public.goals add constraint goals_status_check
  check (status in ('active', 'paused', 'completed', 'released'));

create table public.future_selves (
  user_id uuid primary key references auth.users (id) on delete cascade,
  statement text not null,
  privacy_level text not null default 'standard',
  mus_may_read boolean not null default true,
  mus_may_remember boolean not null default false,
  provenance text not null default 'user',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null,
  server_updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint future_selves_statement_len check (char_length(trim(statement)) between 1 and 2000),
  constraint future_selves_privacy_check check (privacy_level in ('private', 'standard', 'shareable')),
  constraint future_selves_provenance_check
    check (provenance in ('user', 'device', 'external', 'mus_inference', 'mus_plan', 'estimate'))
);

create table public.compasses (
  user_id uuid primary key references auth.users (id) on delete cascade,
  matters_now text,
  protect text,
  struggling_with text,
  do_not_become text,
  privacy_level text not null default 'standard',
  mus_may_read boolean not null default true,
  mus_may_remember boolean not null default false,
  provenance text not null default 'user',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null,
  server_updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint compasses_privacy_check check (privacy_level in ('private', 'standard', 'shareable')),
  constraint compasses_provenance_check
    check (provenance in ('user', 'device', 'external', 'mus_inference', 'mus_plan', 'estimate'))
);

create table public.inbox_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null default 'note',
  content text not null,
  life_area text,
  processed_at timestamptz,
  privacy_level text not null default 'private',
  mus_may_read boolean not null default false,
  mus_may_remember boolean not null default false,
  provenance text not null default 'user',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null,
  server_updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint inbox_items_content_len check (char_length(trim(content)) between 1 and 4000),
  constraint inbox_items_kind_check check (kind in ('note', 'obligation', 'idea', 'voice')),
  constraint inbox_items_area_check check (
    life_area is null or life_area in (
      'physical', 'mind', 'emotions', 'faith', 'work', 'relationships', 'money', 'purpose'
    )
  ),
  constraint inbox_items_privacy_check check (privacy_level in ('private', 'standard', 'shareable')),
  constraint inbox_items_provenance_check
    check (provenance in ('user', 'device', 'external', 'mus_inference', 'mus_plan', 'estimate'))
);

create table public.personal_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  active boolean not null default true,
  privacy_level text not null default 'standard',
  mus_may_read boolean not null default true,
  mus_may_remember boolean not null default false,
  provenance text not null default 'user',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null,
  server_updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint personal_rules_title_len check (char_length(trim(title)) between 1 and 200),
  constraint personal_rules_privacy_check check (privacy_level in ('private', 'standard', 'shareable')),
  constraint personal_rules_provenance_check
    check (provenance in ('user', 'device', 'external', 'mus_inference', 'mus_plan', 'estimate'))
);

create index future_selves_server_updated_at_idx on public.future_selves (server_updated_at);
create index compasses_server_updated_at_idx on public.compasses (server_updated_at);
create index inbox_items_user_updated_idx on public.inbox_items (user_id, updated_at);
create index inbox_items_server_updated_at_idx on public.inbox_items (server_updated_at);
create index personal_rules_user_active_idx on public.personal_rules (user_id, active);
create index personal_rules_server_updated_at_idx on public.personal_rules (server_updated_at);

create trigger future_selves_touch before insert or update on public.future_selves
  for each row execute function public.kayamo_touch_row();
create trigger compasses_touch before insert or update on public.compasses
  for each row execute function public.kayamo_touch_row();
create trigger inbox_items_touch before insert or update on public.inbox_items
  for each row execute function public.kayamo_touch_row();
create trigger personal_rules_touch before insert or update on public.personal_rules
  for each row execute function public.kayamo_touch_row();
create trigger future_selves_preserve_tombstone before update on public.future_selves
  for each row execute function public.kayamo_preserve_tombstone();
create trigger compasses_preserve_tombstone before update on public.compasses
  for each row execute function public.kayamo_preserve_tombstone();
create trigger inbox_items_preserve_tombstone before update on public.inbox_items
  for each row execute function public.kayamo_preserve_tombstone();
create trigger personal_rules_preserve_tombstone before update on public.personal_rules
  for each row execute function public.kayamo_preserve_tombstone();

alter table public.future_selves enable row level security;
alter table public.compasses enable row level security;
alter table public.inbox_items enable row level security;
alter table public.personal_rules enable row level security;

create policy future_selves_select on public.future_selves for select to authenticated
  using (user_id = auth.uid() and deleted_at is null);
create policy future_selves_insert on public.future_selves for insert to authenticated
  with check (user_id = auth.uid());
create policy future_selves_update on public.future_selves for update to authenticated
  using (user_id = auth.uid() and deleted_at is null) with check (user_id = auth.uid());

create policy compasses_select on public.compasses for select to authenticated
  using (user_id = auth.uid() and deleted_at is null);
create policy compasses_insert on public.compasses for insert to authenticated
  with check (user_id = auth.uid());
create policy compasses_update on public.compasses for update to authenticated
  using (user_id = auth.uid() and deleted_at is null) with check (user_id = auth.uid());

create policy inbox_items_select on public.inbox_items for select to authenticated
  using (user_id = auth.uid() and deleted_at is null);
create policy inbox_items_insert on public.inbox_items for insert to authenticated
  with check (user_id = auth.uid());
create policy inbox_items_update on public.inbox_items for update to authenticated
  using (user_id = auth.uid() and deleted_at is null) with check (user_id = auth.uid());

create policy personal_rules_select on public.personal_rules for select to authenticated
  using (user_id = auth.uid() and deleted_at is null);
create policy personal_rules_insert on public.personal_rules for insert to authenticated
  with check (user_id = auth.uid());
create policy personal_rules_update on public.personal_rules for update to authenticated
  using (user_id = auth.uid() and deleted_at is null) with check (user_id = auth.uid());

revoke all on public.future_selves, public.compasses, public.inbox_items, public.personal_rules
  from public, anon;
grant select, insert, update on public.future_selves, public.compasses,
  public.inbox_items, public.personal_rules to authenticated;
grant all on public.future_selves, public.compasses, public.inbox_items, public.personal_rules
  to service_role;
revoke delete on public.future_selves, public.compasses, public.inbox_items, public.personal_rules
  from authenticated;
