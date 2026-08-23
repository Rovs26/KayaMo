-- Bundle 6 plan-focus-reflect, notification preferences, and opt-in faith.
-- Reflective prose and prayer journals intentionally have no server table.

create table public.daily_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  logical_date date not null,
  selected_action_kind text,
  selected_record_id uuid,
  selected_label_snapshot text,
  morning_completed_at timestamptz,
  evening_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null,
  server_updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint daily_plans_action_kind_check check (
    selected_action_kind is null or selected_action_kind in ('task', 'routine', 'custom')
  ),
  constraint daily_plans_action_shape_check check (
    (selected_action_kind is null and selected_record_id is null and selected_label_snapshot is null)
    or (selected_action_kind = 'custom' and selected_record_id is null
      and char_length(trim(selected_label_snapshot)) between 1 and 160)
    or (selected_action_kind in ('task', 'routine') and selected_record_id is not null
      and char_length(trim(selected_label_snapshot)) between 1 and 160)
  )
);

create table public.focus_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  daily_plan_id uuid references public.daily_plans (id) on delete restrict,
  logical_date date not null,
  target_kind text not null,
  target_record_id uuid,
  target_label_snapshot text not null,
  planned_minutes integer not null default 25,
  status text not null default 'scheduled',
  started_at timestamptz,
  ends_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null,
  server_updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint focus_sessions_target_kind_check
    check (target_kind in ('task', 'routine', 'custom')),
  constraint focus_sessions_status_check
    check (status in ('scheduled', 'active', 'completed', 'cancelled')),
  constraint focus_sessions_target_shape_check check (
    (target_kind = 'custom' and target_record_id is null)
    or (target_kind in ('task', 'routine') and target_record_id is not null)
  ),
  constraint focus_sessions_label_len
    check (char_length(trim(target_label_snapshot)) between 1 and 160),
  constraint focus_sessions_duration_check check (planned_minutes between 1 and 180),
  constraint focus_sessions_state_shape_check check (
    (status = 'scheduled' and started_at is null and ends_at is null
      and completed_at is null and cancelled_at is null)
    or (status = 'active' and started_at is not null and ends_at is not null
      and completed_at is null and cancelled_at is null)
    or (status = 'completed' and started_at is not null and ends_at is not null
      and completed_at is not null and cancelled_at is null)
    or (status = 'cancelled' and completed_at is null and cancelled_at is not null)
  )
);

create table public.daily_loop_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  notifications_enabled boolean not null default false,
  morning_reminder_at time not null default '08:00:00',
  evening_reminder_at time not null default '20:00:00',
  quiet_starts_at time not null default '22:00:00',
  quiet_ends_at time not null default '07:00:00',
  faith_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null,
  server_updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.scripture_passages (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  reference text not null,
  text text not null,
  translation_key text not null,
  license text not null,
  source_url text not null,
  tags text[] not null default '{}',
  reviewed_at timestamptz not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null,
  server_updated_at timestamptz not null default now(),
  constraint scripture_passages_text_len check (char_length(text) between 1 and 1200),
  constraint scripture_passages_translation_check check (translation_key = 'engwebp')
);

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null,
  server_updated_at timestamptz not null default now(),
  constraint push_subscriptions_endpoint_len check (char_length(endpoint) between 10 and 4000),
  unique (user_id, endpoint)
);

create index daily_plans_user_date_idx on public.daily_plans (user_id, logical_date);
create index daily_plans_server_updated_at_idx on public.daily_plans (server_updated_at);
create unique index daily_plans_live_day_uidx
  on public.daily_plans (user_id, logical_date) where deleted_at is null;
create index focus_sessions_user_date_idx
  on public.focus_sessions (user_id, logical_date);
create index focus_sessions_server_updated_at_idx
  on public.focus_sessions (server_updated_at);
create index daily_loop_preferences_server_updated_at_idx
  on public.daily_loop_preferences (server_updated_at);
create index scripture_passages_tags_idx on public.scripture_passages using gin (tags);
create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

insert into public.scripture_passages
  (id, key, reference, text, translation_key, license, source_url, tags,
   reviewed_at, updated_at)
values
  ('e1000000-0000-4000-8000-000000000001', 'psalm-23-1-3', 'Psalm 23:1–3',
   'The LORD is my shepherd; I shall lack nothing. He makes me lie down in green pastures. He leads me beside still waters. He restores my soul. He guides me in the paths of righteousness for his name’s sake.',
   'engwebp', 'Public Domain', 'https://ebible.org/engwebp/PSA023.htm',
   array['rest', 'guidance', 'hope'], '2026-08-22T00:00:00.000Z', now()),
  ('e1000000-0000-4000-8000-000000000002', 'psalm-23-4', 'Psalm 23:4',
   'Even though I walk through the valley of the shadow of death, I will fear no evil, for you are with me. Your rod and your staff, they comfort me.',
   'engwebp', 'Public Domain', 'https://ebible.org/engwebp/PSA023.htm',
   array['fear', 'comfort', 'courage'], '2026-08-22T00:00:00.000Z', now()),
  ('e1000000-0000-4000-8000-000000000003', 'isaiah-41-10', 'Isaiah 41:10',
   'Don’t you be afraid, for I am with you. Don’t be dismayed, for I am your God. I will strengthen you. Yes, I will help you. Yes, I will uphold you with the right hand of my righteousness.',
   'engwebp', 'Public Domain', 'https://ebible.org/engwebp/ISA041.htm',
   array['fear', 'strength', 'help'], '2026-08-22T00:00:00.000Z', now()),
  ('e1000000-0000-4000-8000-000000000004', 'matthew-11-28-30', 'Matthew 11:28–30',
   'Come to me, all you who labor and are heavily burdened, and I will give you rest. Take my yoke upon you and learn from me, for I am gentle and humble in heart; and you will find rest for your souls. For my yoke is easy, and my burden is light.',
   'engwebp', 'Public Domain', 'https://ebible.org/engwebp/MAT011.htm',
   array['rest', 'burden', 'gentleness'], '2026-08-22T00:00:00.000Z', now());

create or replace function public.kayamo_prepare_daily_plan()
returns trigger language plpgsql set search_path = public as $$
declare v_owner uuid;
begin
  if tg_op = 'UPDATE' then
    new.user_id := old.user_id;
    if new.selected_action_kind is not distinct from old.selected_action_kind
      and new.selected_record_id is not distinct from old.selected_record_id then
      return new;
    end if;
  end if;
  if new.selected_action_kind = 'task' then
    select user_id into v_owner from public.tasks
    where id = new.selected_record_id and deleted_at is null;
  elsif new.selected_action_kind = 'routine' then
    select user_id into v_owner from public.routines
    where id = new.selected_record_id and deleted_at is null;
  else
    v_owner := new.user_id;
  end if;
  if v_owner is null or v_owner <> new.user_id then
    raise exception 'selected action is not a live owned record' using errcode = '23503';
  end if;
  return new;
end;
$$;

create or replace function public.kayamo_prepare_focus_session()
returns trigger language plpgsql set search_path = public as $$
declare v_owner uuid;
begin
  if tg_op = 'UPDATE' then
    new.user_id := old.user_id;
    if new.daily_plan_id is not distinct from old.daily_plan_id
      and new.target_kind is not distinct from old.target_kind
      and new.target_record_id is not distinct from old.target_record_id then
      return new;
    end if;
  end if;
  if new.daily_plan_id is not null then
    select user_id into v_owner from public.daily_plans
    where id = new.daily_plan_id and deleted_at is null;
    if v_owner is null or v_owner <> new.user_id then
      raise exception 'daily plan is not a live owned record' using errcode = '23503';
    end if;
  end if;
  if new.target_kind = 'task' then
    select user_id into v_owner from public.tasks
    where id = new.target_record_id and deleted_at is null;
  elsif new.target_kind = 'routine' then
    select user_id into v_owner from public.routines
    where id = new.target_record_id and deleted_at is null;
  else
    v_owner := new.user_id;
  end if;
  if v_owner is null or v_owner <> new.user_id then
    raise exception 'focus target is not a live owned record' using errcode = '23503';
  end if;
  return new;
end;
$$;

create trigger daily_plans_prepare before insert or update on public.daily_plans
  for each row execute function public.kayamo_prepare_daily_plan();
create trigger focus_sessions_prepare before insert or update on public.focus_sessions
  for each row execute function public.kayamo_prepare_focus_session();
create trigger daily_plans_touch before insert or update on public.daily_plans
  for each row execute function public.kayamo_touch_row();
create trigger focus_sessions_touch before insert or update on public.focus_sessions
  for each row execute function public.kayamo_touch_row();
create trigger daily_loop_preferences_touch before insert or update
  on public.daily_loop_preferences for each row execute function public.kayamo_touch_row();
create trigger scripture_passages_touch before insert or update
  on public.scripture_passages for each row execute function public.kayamo_touch_row();
create trigger push_subscriptions_touch before insert or update
  on public.push_subscriptions for each row execute function public.kayamo_touch_row();
create trigger daily_plans_preserve_tombstone before update on public.daily_plans
  for each row execute function public.kayamo_preserve_tombstone();
create trigger focus_sessions_preserve_tombstone before update on public.focus_sessions
  for each row execute function public.kayamo_preserve_tombstone();
create trigger daily_loop_preferences_preserve_tombstone before update
  on public.daily_loop_preferences for each row execute function public.kayamo_preserve_tombstone();

alter table public.daily_plans enable row level security;
alter table public.focus_sessions enable row level security;
alter table public.daily_loop_preferences enable row level security;
alter table public.scripture_passages enable row level security;
alter table public.push_subscriptions enable row level security;

create policy daily_plans_select on public.daily_plans for select to authenticated
  using (user_id = auth.uid() and deleted_at is null);
create policy daily_plans_insert on public.daily_plans for insert to authenticated
  with check (user_id = auth.uid());
create policy daily_plans_update on public.daily_plans for update to authenticated
  using (user_id = auth.uid() and deleted_at is null)
  with check (user_id = auth.uid());

create policy focus_sessions_select on public.focus_sessions for select to authenticated
  using (user_id = auth.uid() and deleted_at is null);
create policy focus_sessions_insert on public.focus_sessions for insert to authenticated
  with check (user_id = auth.uid());
create policy focus_sessions_update on public.focus_sessions for update to authenticated
  using (user_id = auth.uid() and deleted_at is null)
  with check (user_id = auth.uid());

create policy daily_loop_preferences_select on public.daily_loop_preferences
  for select to authenticated using (user_id = auth.uid() and deleted_at is null);
create policy daily_loop_preferences_insert on public.daily_loop_preferences
  for insert to authenticated with check (user_id = auth.uid());
create policy daily_loop_preferences_update on public.daily_loop_preferences
  for update to authenticated
  using (user_id = auth.uid() and deleted_at is null)
  with check (user_id = auth.uid());

create policy scripture_passages_select on public.scripture_passages
  for select to authenticated using (active);
create policy push_subscriptions_select on public.push_subscriptions
  for select to authenticated using (user_id = auth.uid());
create policy push_subscriptions_insert on public.push_subscriptions
  for insert to authenticated with check (user_id = auth.uid());
create policy push_subscriptions_update on public.push_subscriptions
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy push_subscriptions_delete on public.push_subscriptions
  for delete to authenticated using (user_id = auth.uid());

revoke all on public.daily_plans, public.focus_sessions,
  public.daily_loop_preferences, public.scripture_passages,
  public.push_subscriptions from public, anon;
grant select, insert, update on public.daily_plans, public.focus_sessions,
  public.daily_loop_preferences to authenticated;
grant select on public.scripture_passages to authenticated;
grant select, insert, update, delete on public.push_subscriptions to authenticated;
grant all on public.daily_plans, public.focus_sessions,
  public.daily_loop_preferences, public.scripture_passages,
  public.push_subscriptions to service_role;
revoke delete on public.daily_plans, public.focus_sessions,
  public.daily_loop_preferences from authenticated;

revoke all on function public.kayamo_prepare_daily_plan(),
  public.kayamo_prepare_focus_session() from public, anon;
grant execute on function public.kayamo_prepare_daily_plan(),
  public.kayamo_prepare_focus_session() to authenticated, service_role;
