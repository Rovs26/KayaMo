-- Bundle 5 goals, habits, achievements, and companion growth.
-- User intent is syncable/LWW/tombstoned. Rewards are append-only, validated
-- against confirmed source records, and idempotent by stable event key.

create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  description text,
  kind text not null default 'goal',
  status text not null default 'active',
  starts_on date,
  target_date date,
  completed_at timestamptz,
  origin text not null default 'user',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null,
  server_updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint goals_title_len check (char_length(trim(title)) between 1 and 180),
  constraint goals_kind_check check (kind in ('goal', 'campaign', 'chapter')),
  constraint goals_status_check check (status in ('active', 'paused', 'completed')),
  constraint goals_origin_check check (origin in ('user', 'coco_confirmed')),
  constraint goals_completed_state_check
    check ((status = 'completed') = (completed_at is not null))
);

create table public.goal_milestones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  goal_id uuid not null references public.goals (id) on delete restrict,
  title text not null,
  sort_order integer not null default 0,
  target_date date,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null,
  server_updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint goal_milestones_title_len
    check (char_length(trim(title)) between 1 and 160),
  constraint goal_milestones_order_check check (sort_order >= 0)
);

create table public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  goal_id uuid references public.goals (id) on delete restrict,
  title text not null,
  notes text,
  frequency text not null default 'daily',
  target_per_period integer not null default 1,
  active boolean not null default true,
  origin text not null default 'user',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null,
  server_updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint habits_title_len check (char_length(trim(title)) between 1 and 120),
  constraint habits_frequency_check check (frequency in ('daily', 'weekly')),
  constraint habits_origin_check check (origin in ('user', 'coco_confirmed')),
  constraint habits_target_per_period_check check (target_per_period between 1 and 50)
);

create table public.habit_completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  habit_id uuid not null references public.habits (id) on delete restrict,
  logical_date date not null,
  completed_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null,
  server_updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.evolution_stages (
  key text primary key,
  name text not null,
  description text not null,
  minimum_points integer not null unique,
  sort_order integer not null unique,
  updated_at timestamptz not null,
  server_updated_at timestamptz not null default now(),
  constraint evolution_stages_points_check check (minimum_points >= 0),
  constraint evolution_stages_order_check check (sort_order >= 0)
);

create table public.achievement_definitions (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  title text not null,
  description text not null,
  metric text not null,
  event_type text,
  threshold integer not null,
  active boolean not null default true,
  updated_at timestamptz not null,
  server_updated_at timestamptz not null default now(),
  constraint achievement_definitions_metric_check
    check (metric in ('total_points', 'event_count', 'event_type_count')),
  constraint achievement_definitions_event_type_check check (
    event_type is null or event_type in (
      'task_completed', 'routine_completed', 'habit_completed',
      'milestone_completed', 'goal_completed', 'workout_completed',
      'food_logged', 'recovery_return'
    )
  ),
  constraint achievement_definitions_threshold_check check (threshold > 0),
  constraint achievement_definitions_rule_shape check (
    (metric = 'event_type_count' and event_type is not null)
    or (metric <> 'event_type_count' and event_type is null)
  )
);

create table public.cosmetic_definitions (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  title text not null,
  description text not null,
  required_stage_key text not null references public.evolution_stages (key) on delete restrict,
  asset_key text not null,
  active boolean not null default true,
  updated_at timestamptz not null,
  server_updated_at timestamptz not null default now()
);

create table public.companion_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  event_key text not null,
  event_type text not null,
  source_table text not null,
  source_id uuid not null,
  logical_date date not null,
  points integer not null default 0,
  created_at timestamptz not null default now(),
  server_updated_at timestamptz not null default now(),
  constraint companion_events_type_check check (event_type in (
    'task_completed', 'routine_completed', 'habit_completed',
    'milestone_completed', 'goal_completed', 'workout_completed',
    'food_logged', 'recovery_return'
  )),
  constraint companion_events_points_check check (points >= 0)
);

create table public.companion_state (
  user_id uuid primary key references auth.users (id) on delete cascade,
  total_points integer not null default 0,
  stage_key text not null default 'seed'
    references public.evolution_stages (key) on delete restrict,
  selected_cosmetic_id uuid references public.cosmetic_definitions (id) on delete restrict,
  updated_at timestamptz not null,
  server_updated_at timestamptz not null default now(),
  constraint companion_state_points_check check (total_points >= 0)
);

create table public.user_achievements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  achievement_id uuid not null references public.achievement_definitions (id) on delete restrict,
  source_event_id uuid not null references public.companion_events (id) on delete restrict,
  earned_at timestamptz not null default now(),
  server_updated_at timestamptz not null default now()
);

create table public.cosmetic_unlocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  cosmetic_id uuid not null references public.cosmetic_definitions (id) on delete restrict,
  source_event_id uuid not null references public.companion_events (id) on delete restrict,
  unlocked_at timestamptz not null default now(),
  server_updated_at timestamptz not null default now()
);

create index goals_user_status_idx on public.goals (user_id, status);
create index goals_server_updated_at_idx on public.goals (server_updated_at);
create index goal_milestones_goal_order_idx
  on public.goal_milestones (goal_id, sort_order);
create index goal_milestones_server_updated_at_idx
  on public.goal_milestones (server_updated_at);
create unique index goal_milestones_live_order_uidx
  on public.goal_milestones (goal_id, sort_order) where deleted_at is null;
create index habits_user_active_idx on public.habits (user_id, active);
create index habits_server_updated_at_idx on public.habits (server_updated_at);
create index habit_completions_user_date_idx
  on public.habit_completions (user_id, logical_date);
create index habit_completions_server_updated_at_idx
  on public.habit_completions (server_updated_at);
create unique index habit_completions_live_day_uidx
  on public.habit_completions (habit_id, logical_date) where deleted_at is null;
create unique index companion_events_user_key_uidx
  on public.companion_events (user_id, event_key);
create index companion_events_user_date_idx
  on public.companion_events (user_id, logical_date);
create index companion_events_server_updated_at_idx
  on public.companion_events (server_updated_at);
create unique index user_achievements_user_definition_uidx
  on public.user_achievements (user_id, achievement_id);
create index user_achievements_server_updated_at_idx
  on public.user_achievements (server_updated_at);
create unique index cosmetic_unlocks_user_cosmetic_uidx
  on public.cosmetic_unlocks (user_id, cosmetic_id);
create index cosmetic_unlocks_server_updated_at_idx
  on public.cosmetic_unlocks (server_updated_at);

insert into public.evolution_stages
  (key, name, description, minimum_points, sort_order, updated_at)
values
  ('seed', 'Seed', 'Coco is carrying the possibility of new growth.', 0, 0, now()),
  ('sprout', 'Sprout', 'Small confirmed actions have begun to take root.', 100, 1, now()),
  ('sapling', 'Sapling', 'Consistency is becoming a living practice.', 300, 2, now()),
  ('young_tree', 'Young tree', 'Coco reflects a resilient pattern of returning.', 700, 3, now()),
  ('flourishing_tree', 'Flourishing tree', 'Long-term care has become visible growth.', 1500, 4, now());

insert into public.achievement_definitions
  (id, key, title, description, metric, event_type, threshold, updated_at)
values
  ('c1000000-0000-4000-8000-000000000001', 'first_step', 'First step', 'Complete one confirmed action.', 'event_count', null, 1, now()),
  ('c1000000-0000-4000-8000-000000000002', 'ten_true_steps', 'Ten true steps', 'Complete ten confirmed actions.', 'event_count', null, 10, now()),
  ('c1000000-0000-4000-8000-000000000003', 'welcome_back', 'Welcome back', 'Return to a routine or habit after time away.', 'event_type_count', 'recovery_return', 1, now()),
  ('c1000000-0000-4000-8000-000000000004', 'milestone_maker', 'Milestone maker', 'Complete a confirmed goal milestone.', 'event_type_count', 'milestone_completed', 1, now()),
  ('c1000000-0000-4000-8000-000000000005', 'goal_keeper', 'Goal keeper', 'Complete a goal you chose.', 'event_type_count', 'goal_completed', 1, now()),
  ('c1000000-0000-4000-8000-000000000006', 'sprout_stage', 'New growth', 'Help Coco reach the sprout stage.', 'total_points', null, 100, now());

insert into public.cosmetic_definitions
  (id, key, title, description, required_stage_key, asset_key, updated_at)
values
  ('d1000000-0000-4000-8000-000000000001', 'morning_dew', 'Morning dew', 'A quiet accent for a new beginning.', 'seed', 'coco.morning_dew', now()),
  ('d1000000-0000-4000-8000-000000000002', 'hope_ribbon', 'Hope ribbon', 'A blue-white ribbon unlocked through steady action.', 'sprout', 'coco.hope_ribbon', now()),
  ('d1000000-0000-4000-8000-000000000003', 'steadfast_glow', 'Steadfast glow', 'A warm glow that reflects resilient return.', 'young_tree', 'coco.steadfast_glow', now());

create or replace function public.kayamo_prepare_goal_child()
returns trigger
language plpgsql
set search_path = public
as $$
declare v_user_id uuid;
begin
  if tg_op = 'UPDATE' and new.goal_id is not distinct from old.goal_id then
    new.user_id := old.user_id;
    return new;
  end if;
  select g.user_id into v_user_id from public.goals g
  where g.id = new.goal_id and g.deleted_at is null;
  if v_user_id is null then raise exception 'live goal not found' using errcode = '23503'; end if;
  new.user_id := v_user_id;
  return new;
end;
$$;

create or replace function public.kayamo_prepare_habit()
returns trigger
language plpgsql
set search_path = public
as $$
declare v_user_id uuid;
begin
  if new.goal_id is null then return new; end if;
  if tg_op = 'UPDATE' and new.goal_id is not distinct from old.goal_id then
    new.user_id := old.user_id;
    return new;
  end if;
  select g.user_id into v_user_id from public.goals g
  where g.id = new.goal_id and g.deleted_at is null;
  if v_user_id is null then raise exception 'live goal not found' using errcode = '23503'; end if;
  new.user_id := v_user_id;
  return new;
end;
$$;

create or replace function public.kayamo_prepare_habit_completion()
returns trigger
language plpgsql
set search_path = public
as $$
declare v_user_id uuid; v_tz text; v_start time;
begin
  if tg_op = 'UPDATE' and new.habit_id is not distinct from old.habit_id then
    new.user_id := old.user_id;
  else
    select h.user_id into v_user_id from public.habits h
    where h.id = new.habit_id and h.deleted_at is null and h.active;
    if v_user_id is null then raise exception 'active habit not found' using errcode = '23503'; end if;
    new.user_id := v_user_id;
  end if;
  if tg_op = 'INSERT' or new.completed_at is distinct from old.completed_at then
    select p.timezone, p.day_starts_at into v_tz, v_start
    from public.profiles p where p.user_id = new.user_id;
    new.logical_date := public.kayamo_logical_date(new.completed_at, v_tz, v_start);
  else
    new.logical_date := old.logical_date;
  end if;
  return new;
end;
$$;

create or replace function public.kayamo_cascade_journey_tombstone()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.deleted_at is null and new.deleted_at is not null then
    if tg_table_name = 'goals' then
      update public.goal_milestones
      set deleted_at = coalesce(deleted_at, new.deleted_at),
          updated_at = greatest(updated_at, new.updated_at)
      where goal_id = new.id and deleted_at is null;
      update public.habits
      set deleted_at = coalesce(deleted_at, new.deleted_at),
          updated_at = greatest(updated_at, new.updated_at)
      where goal_id = new.id and deleted_at is null;
    elsif tg_table_name = 'habits' then
      update public.habit_completions
      set deleted_at = coalesce(deleted_at, new.deleted_at),
          updated_at = greatest(updated_at, new.updated_at)
      where habit_id = new.id and deleted_at is null;
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.kayamo_prepare_companion_event()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_user_id uuid;
  v_date date;
  v_previous date;
begin
  if new.event_key <> new.event_type || ':' || new.source_table || ':' || new.source_id::text then
    raise exception 'invalid companion event key' using errcode = '23514';
  end if;

  case new.event_type
    when 'task_completed' then
      if new.source_table <> 'tasks' then raise exception 'invalid event source' using errcode = '23514'; end if;
      select t.user_id, coalesce(t.scheduled_for,
        public.kayamo_logical_date(t.completed_at, p.timezone, p.day_starts_at))
      into v_user_id, v_date from public.tasks t
      join public.profiles p on p.user_id = t.user_id
      where t.id = new.source_id and t.completed_at is not null and t.deleted_at is null;
      new.points := 10;
    when 'routine_completed' then
      if new.source_table <> 'routine_completions' then raise exception 'invalid event source' using errcode = '23514'; end if;
      select r.user_id, r.logical_date into v_user_id, v_date
      from public.routine_completions r
      where r.id = new.source_id and r.deleted_at is null;
      new.points := 8;
    when 'habit_completed' then
      if new.source_table <> 'habit_completions' then raise exception 'invalid event source' using errcode = '23514'; end if;
      select h.user_id, h.logical_date into v_user_id, v_date
      from public.habit_completions h
      where h.id = new.source_id and h.deleted_at is null;
      new.points := 8;
    when 'milestone_completed' then
      if new.source_table <> 'goal_milestones' then raise exception 'invalid event source' using errcode = '23514'; end if;
      select m.user_id, public.kayamo_logical_date(m.completed_at, p.timezone, p.day_starts_at)
      into v_user_id, v_date from public.goal_milestones m
      join public.profiles p on p.user_id = m.user_id
      where m.id = new.source_id and m.completed_at is not null and m.deleted_at is null;
      new.points := 20;
    when 'goal_completed' then
      if new.source_table <> 'goals' then raise exception 'invalid event source' using errcode = '23514'; end if;
      select g.user_id, public.kayamo_logical_date(g.completed_at, p.timezone, p.day_starts_at)
      into v_user_id, v_date from public.goals g
      join public.profiles p on p.user_id = g.user_id
      where g.id = new.source_id and g.status = 'completed' and g.deleted_at is null;
      new.points := 50;
    when 'workout_completed' then
      if new.source_table <> 'workouts' then raise exception 'invalid event source' using errcode = '23514'; end if;
      select w.user_id, w.logical_date into v_user_id, v_date from public.workouts w
      where w.id = new.source_id and w.status = 'completed'
        and w.ended_at is not null and w.deleted_at is null;
      new.points := 20;
    when 'food_logged' then
      if new.source_table <> 'food_entries' then raise exception 'invalid event source' using errcode = '23514'; end if;
      select f.user_id, f.logical_date into v_user_id, v_date from public.food_entries f
      where f.id = new.source_id and f.deleted_at is null;
      new.points := 2;
    when 'recovery_return' then
      if new.source_table = 'habit_completions' then
        select h.user_id, h.logical_date into v_user_id, v_date
        from public.habit_completions h where h.id = new.source_id and h.deleted_at is null;
        select max(previous.logical_date) into v_previous
        from public.habit_completions current_row
        join public.habit_completions previous on previous.habit_id = current_row.habit_id
        where current_row.id = new.source_id and previous.user_id = v_user_id
          and previous.deleted_at is null and previous.logical_date < v_date;
      elsif new.source_table = 'routine_completions' then
        select r.user_id, r.logical_date into v_user_id, v_date
        from public.routine_completions r where r.id = new.source_id and r.deleted_at is null;
        select max(previous.logical_date) into v_previous
        from public.routine_completions current_row
        join public.routine_completions previous on previous.routine_id = current_row.routine_id
        where current_row.id = new.source_id and previous.user_id = v_user_id
          and previous.deleted_at is null and previous.logical_date < v_date;
      else
        raise exception 'invalid recovery source' using errcode = '23514';
      end if;
      if v_previous is null or v_previous > v_date - 2 then
        raise exception 'recovery requires a prior completion and a missed interval' using errcode = '23514';
      end if;
      new.points := 15;
    else
      raise exception 'unsupported companion event' using errcode = '23514';
  end case;

  if v_user_id is null or v_date is null then
    raise exception 'confirmed event source not found' using errcode = '23503';
  end if;
  new.user_id := v_user_id;
  new.logical_date := v_date;
  return new;
end;
$$;

create or replace function public.kayamo_apply_companion_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_total integer;
begin
  insert into public.companion_state
    (user_id, total_points, stage_key, updated_at)
  values (new.user_id, new.points, 'seed', now())
  on conflict (user_id) do update
    set total_points = public.companion_state.total_points + excluded.total_points,
        updated_at = now()
  returning total_points into v_total;

  update public.companion_state s
  set stage_key = (
    select e.key from public.evolution_stages e
    where e.minimum_points <= v_total order by e.minimum_points desc limit 1
  ), updated_at = now()
  where s.user_id = new.user_id;

  insert into public.user_achievements
    (user_id, achievement_id, source_event_id, earned_at)
  select new.user_id, a.id, new.id, now()
  from public.achievement_definitions a
  where a.active and (
    (a.metric = 'total_points' and v_total >= a.threshold)
    or (a.metric = 'event_count' and
      (select count(*) from public.companion_events e where e.user_id = new.user_id) >= a.threshold)
    or (a.metric = 'event_type_count' and
      (select count(*) from public.companion_events e
       where e.user_id = new.user_id and e.event_type = a.event_type) >= a.threshold)
  )
  on conflict (user_id, achievement_id) do nothing;

  insert into public.cosmetic_unlocks
    (user_id, cosmetic_id, source_event_id, unlocked_at)
  select new.user_id, c.id, new.id, now()
  from public.cosmetic_definitions c
  join public.evolution_stages required on required.key = c.required_stage_key
  where c.active and required.minimum_points <= v_total
  on conflict (user_id, cosmetic_id) do nothing;
  return new;
end;
$$;

create trigger goals_touch before insert or update on public.goals
  for each row execute function public.kayamo_touch_row();
create trigger goal_milestones_prepare before insert or update on public.goal_milestones
  for each row execute function public.kayamo_prepare_goal_child();
create trigger goal_milestones_touch before insert or update on public.goal_milestones
  for each row execute function public.kayamo_touch_row();
create trigger habits_prepare before insert or update on public.habits
  for each row execute function public.kayamo_prepare_habit();
create trigger habits_touch before insert or update on public.habits
  for each row execute function public.kayamo_touch_row();
create trigger habit_completions_prepare before insert or update on public.habit_completions
  for each row execute function public.kayamo_prepare_habit_completion();
create trigger habit_completions_touch before insert or update on public.habit_completions
  for each row execute function public.kayamo_touch_row();
create trigger companion_state_touch before insert or update on public.companion_state
  for each row execute function public.kayamo_touch_row();
create trigger evolution_stages_touch before insert or update on public.evolution_stages
  for each row execute function public.kayamo_touch_row();
create trigger achievement_definitions_touch before insert or update
  on public.achievement_definitions for each row
  execute function public.kayamo_touch_row();
create trigger cosmetic_definitions_touch before insert or update
  on public.cosmetic_definitions for each row
  execute function public.kayamo_touch_row();
create trigger goals_preserve_tombstone before update on public.goals
  for each row execute function public.kayamo_preserve_tombstone();
create trigger goal_milestones_preserve_tombstone before update on public.goal_milestones
  for each row execute function public.kayamo_preserve_tombstone();
create trigger habits_preserve_tombstone before update on public.habits
  for each row execute function public.kayamo_preserve_tombstone();
create trigger habit_completions_preserve_tombstone before update on public.habit_completions
  for each row execute function public.kayamo_preserve_tombstone();
create trigger goals_cascade_tombstone after update of deleted_at on public.goals
  for each row execute function public.kayamo_cascade_journey_tombstone();
create trigger habits_cascade_tombstone after update of deleted_at on public.habits
  for each row execute function public.kayamo_cascade_journey_tombstone();
create trigger companion_events_prepare before insert on public.companion_events
  for each row execute function public.kayamo_prepare_companion_event();
create trigger companion_events_apply after insert on public.companion_events
  for each row execute function public.kayamo_apply_companion_event();

alter table public.goals enable row level security;
alter table public.goal_milestones enable row level security;
alter table public.habits enable row level security;
alter table public.habit_completions enable row level security;
alter table public.evolution_stages enable row level security;
alter table public.achievement_definitions enable row level security;
alter table public.cosmetic_definitions enable row level security;
alter table public.companion_events enable row level security;
alter table public.companion_state enable row level security;
alter table public.user_achievements enable row level security;
alter table public.cosmetic_unlocks enable row level security;

create policy goals_select on public.goals for select to authenticated
  using (user_id = auth.uid() and deleted_at is null);
create policy goals_insert on public.goals for insert to authenticated
  with check (user_id = auth.uid());
create policy goals_update on public.goals for update to authenticated
  using (user_id = auth.uid() and deleted_at is null)
  with check (user_id = auth.uid());

create policy goal_milestones_select on public.goal_milestones for select to authenticated
  using (user_id = auth.uid() and deleted_at is null and exists (
    select 1 from public.goals g where g.id = goal_id and g.deleted_at is null
  ));
create policy goal_milestones_insert on public.goal_milestones for insert to authenticated
  with check (user_id = auth.uid() and exists (
    select 1 from public.goals g where g.id = goal_id
      and g.user_id = auth.uid() and g.deleted_at is null
  ));
create policy goal_milestones_update on public.goal_milestones for update to authenticated
  using (user_id = auth.uid() and deleted_at is null)
  with check (user_id = auth.uid());

create policy habits_select on public.habits for select to authenticated
  using (user_id = auth.uid() and deleted_at is null and (
    goal_id is null or exists (
      select 1 from public.goals g where g.id = goal_id and g.deleted_at is null
    )
  ));
create policy habits_insert on public.habits for insert to authenticated
  with check (user_id = auth.uid() and (
    goal_id is null or exists (
      select 1 from public.goals g where g.id = goal_id
        and g.user_id = auth.uid() and g.deleted_at is null
    )
  ));
create policy habits_update on public.habits for update to authenticated
  using (user_id = auth.uid() and deleted_at is null)
  with check (user_id = auth.uid());

create policy habit_completions_select on public.habit_completions for select to authenticated
  using (user_id = auth.uid() and deleted_at is null and exists (
    select 1 from public.habits h where h.id = habit_id and h.deleted_at is null
  ));
create policy habit_completions_insert on public.habit_completions for insert to authenticated
  with check (user_id = auth.uid() and exists (
    select 1 from public.habits h where h.id = habit_id
      and h.user_id = auth.uid() and h.deleted_at is null
  ));
create policy habit_completions_update on public.habit_completions for update to authenticated
  using (user_id = auth.uid() and deleted_at is null)
  with check (user_id = auth.uid());

create policy evolution_stages_select on public.evolution_stages for select to authenticated
  using (true);
create policy achievement_definitions_select on public.achievement_definitions
  for select to authenticated using (active);
create policy cosmetic_definitions_select on public.cosmetic_definitions
  for select to authenticated using (active);
create policy companion_events_select on public.companion_events for select to authenticated
  using (user_id = auth.uid());
create policy companion_events_insert on public.companion_events for insert to authenticated
  with check (user_id = auth.uid());
create policy companion_state_select on public.companion_state for select to authenticated
  using (user_id = auth.uid());
create policy companion_state_update on public.companion_state for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and (
    selected_cosmetic_id is null or exists (
      select 1 from public.cosmetic_unlocks u
      where u.user_id = auth.uid() and u.cosmetic_id = selected_cosmetic_id
    )
  ));
create policy user_achievements_select on public.user_achievements for select to authenticated
  using (user_id = auth.uid());
create policy cosmetic_unlocks_select on public.cosmetic_unlocks for select to authenticated
  using (user_id = auth.uid());

revoke all on public.goals, public.goal_milestones, public.habits,
  public.habit_completions, public.evolution_stages,
  public.achievement_definitions, public.cosmetic_definitions,
  public.companion_events, public.companion_state,
  public.user_achievements, public.cosmetic_unlocks from public, anon;
grant select, insert, update on public.goals, public.goal_milestones,
  public.habits, public.habit_completions to authenticated;
grant select, insert on public.companion_events to authenticated;
grant select on public.evolution_stages, public.achievement_definitions,
  public.cosmetic_definitions, public.companion_state,
  public.user_achievements, public.cosmetic_unlocks to authenticated;
grant update (selected_cosmetic_id, updated_at) on public.companion_state to authenticated;
grant all on public.goals, public.goal_milestones, public.habits,
  public.habit_completions, public.evolution_stages,
  public.achievement_definitions, public.cosmetic_definitions,
  public.companion_events, public.companion_state,
  public.user_achievements, public.cosmetic_unlocks to service_role;
revoke delete on public.goals, public.goal_milestones,
  public.habits, public.habit_completions from authenticated;

revoke all on function public.kayamo_prepare_goal_child() from public, anon;
revoke all on function public.kayamo_prepare_habit() from public, anon;
revoke all on function public.kayamo_prepare_habit_completion() from public, anon;
revoke all on function public.kayamo_cascade_journey_tombstone() from public, anon;
revoke all on function public.kayamo_prepare_companion_event() from public, anon;
revoke all on function public.kayamo_apply_companion_event() from public, anon;
grant execute on function public.kayamo_prepare_goal_child(),
  public.kayamo_prepare_habit(), public.kayamo_prepare_habit_completion(),
  public.kayamo_cascade_journey_tombstone(),
  public.kayamo_prepare_companion_event(), public.kayamo_apply_companion_event()
  to authenticated, service_role;
