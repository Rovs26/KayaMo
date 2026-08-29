-- Commit-ordered synchronization cursor.
--
-- server_updated_at remains a diagnostic timestamp. server_seq is the only
-- authoritative incremental-pull ordering field.

create schema if not exists private;

revoke all on schema private from public, anon, authenticated;

create table private.sync_user_counters (
  user_id uuid primary key,
  last_seq bigint not null,
  constraint sync_user_counters_last_seq_check
    check (last_seq between 0 and 9007199254740991)
);

revoke all on table private.sync_user_counters from public, anon, authenticated;

create or replace function private.kayamo_next_sync_seq(p_user_id uuid)
returns bigint
language plpgsql
security definer
set search_path = pg_catalog, private
as $$
declare
  v_next_seq bigint;
begin
  if p_user_id is null then
    raise exception 'A sync-visible mutation requires an owner';
  end if;

  insert into private.sync_user_counters as counters (user_id, last_seq)
  values (p_user_id, 1)
  on conflict (user_id) do update
    set last_seq = counters.last_seq + 1
  returning last_seq into v_next_seq;

  if v_next_seq > 9007199254740991 then
    raise exception 'Sync sequence exhausted for owner %', p_user_id;
  end if;

  return v_next_seq;
end;
$$;

revoke all on function private.kayamo_next_sync_seq(uuid)
  from public, anon, authenticated;

create or replace function private.kayamo_assign_server_seq()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, private
as $$
declare
  v_owner uuid;
  v_old_owner uuid;
begin
  v_owner := (to_jsonb(new) ->> tg_argv[0])::uuid;

  if tg_op = 'UPDATE' then
    v_old_owner := (to_jsonb(old) ->> tg_argv[0])::uuid;
    if v_owner is distinct from v_old_owner then
      raise exception 'A sync record owner cannot change';
    end if;
  end if;

  -- Shared canonical exercises have no owner and are intentionally outside
  -- the user-scoped feed. Every user-owned row must receive a sequence.
  if v_owner is null then
    new.server_seq := null;
  else
    new.server_seq := private.kayamo_next_sync_seq(v_owner);
  end if;

  return new;
end;
$$;

revoke all on function private.kayamo_assign_server_seq()
  from public, anon, authenticated;

alter table public.food_entries add column server_seq bigint default 0;
alter table public.weight_logs add column server_seq bigint default 0;
alter table public.workouts add column server_seq bigint default 0;
alter table public.workout_sets add column server_seq bigint default 0;
alter table public.exercises add column server_seq bigint;
alter table public.workout_plans add column server_seq bigint default 0;
alter table public.workout_plan_exercises add column server_seq bigint default 0;
alter table public.meal_templates add column server_seq bigint default 0;
alter table public.tasks add column server_seq bigint default 0;
alter table public.routines add column server_seq bigint default 0;
alter table public.routine_completions add column server_seq bigint default 0;
alter table public.agent_memory add column server_seq bigint default 0;
alter table public.coco_conversations add column server_seq bigint default 0;
alter table public.coco_messages add column server_seq bigint default 0;
alter table public.goals add column server_seq bigint default 0;
alter table public.goal_milestones add column server_seq bigint default 0;
alter table public.habits add column server_seq bigint default 0;
alter table public.habit_completions add column server_seq bigint default 0;
alter table public.companion_events add column server_seq bigint default 0;
alter table public.daily_plans add column server_seq bigint default 0;
alter table public.focus_sessions add column server_seq bigint default 0;
alter table public.daily_loop_preferences add column server_seq bigint default 0;
alter table public.future_selves add column server_seq bigint default 0;
alter table public.compasses add column server_seq bigint default 0;
alter table public.inbox_items add column server_seq bigint default 0;
alter table public.personal_rules add column server_seq bigint default 0;

-- Establish one deterministic historical order across every sync table for
-- each owner. This is only an initial replay order; it does not rewrite domain
-- timestamps or tombstone meaning.
create temporary table kayamo_sync_sequence_backfill as
select
  table_name,
  stable_key,
  user_id,
  row_number() over (
    partition by user_id
    order by server_updated_at, table_name, stable_key
  )::bigint as server_seq
from (
  select 'food_entries'::text table_name, id::text stable_key, user_id, server_updated_at from public.food_entries
  union all select 'weight_logs', id::text, user_id, server_updated_at from public.weight_logs
  union all select 'workouts', id::text, user_id, server_updated_at from public.workouts
  union all select 'workout_sets', id::text, user_id, server_updated_at from public.workout_sets
  union all select 'exercises', id::text, created_by, server_updated_at from public.exercises where created_by is not null
  union all select 'workout_plans', id::text, user_id, server_updated_at from public.workout_plans
  union all select 'workout_plan_exercises', id::text, user_id, server_updated_at from public.workout_plan_exercises
  union all select 'meal_templates', id::text, user_id, server_updated_at from public.meal_templates
  union all select 'tasks', id::text, user_id, server_updated_at from public.tasks
  union all select 'routines', id::text, user_id, server_updated_at from public.routines
  union all select 'routine_completions', id::text, user_id, server_updated_at from public.routine_completions
  union all select 'agent_memory', id::text, user_id, server_updated_at from public.agent_memory
  union all select 'coco_conversations', id::text, user_id, server_updated_at from public.coco_conversations
  union all select 'coco_messages', id::text, user_id, server_updated_at from public.coco_messages
  union all select 'goals', id::text, user_id, server_updated_at from public.goals
  union all select 'goal_milestones', id::text, user_id, server_updated_at from public.goal_milestones
  union all select 'habits', id::text, user_id, server_updated_at from public.habits
  union all select 'habit_completions', id::text, user_id, server_updated_at from public.habit_completions
  union all select 'companion_events', id::text, user_id, server_updated_at from public.companion_events
  union all select 'daily_plans', id::text, user_id, server_updated_at from public.daily_plans
  union all select 'focus_sessions', id::text, user_id, server_updated_at from public.focus_sessions
  union all select 'daily_loop_preferences', user_id::text, user_id, server_updated_at from public.daily_loop_preferences
  union all select 'future_selves', user_id::text, user_id, server_updated_at from public.future_selves
  union all select 'compasses', user_id::text, user_id, server_updated_at from public.compasses
  union all select 'inbox_items', id::text, user_id, server_updated_at from public.inbox_items
  union all select 'personal_rules', id::text, user_id, server_updated_at from public.personal_rules
) historical;

do $$
declare
  v_table text;
  v_stable_key text;
begin
  for v_table, v_stable_key in
    select * from (values
      ('food_entries', 'id'),
      ('weight_logs', 'id'),
      ('workouts', 'id'),
      ('workout_sets', 'id'),
      ('exercises', 'id'),
      ('workout_plans', 'id'),
      ('workout_plan_exercises', 'id'),
      ('meal_templates', 'id'),
      ('tasks', 'id'),
      ('routines', 'id'),
      ('routine_completions', 'id'),
      ('agent_memory', 'id'),
      ('coco_conversations', 'id'),
      ('coco_messages', 'id'),
      ('goals', 'id'),
      ('goal_milestones', 'id'),
      ('habits', 'id'),
      ('habit_completions', 'id'),
      ('companion_events', 'id'),
      ('daily_plans', 'id'),
      ('focus_sessions', 'id'),
      ('daily_loop_preferences', 'user_id'),
      ('future_selves', 'user_id'),
      ('compasses', 'user_id'),
      ('inbox_items', 'id'),
      ('personal_rules', 'id')
    ) as sync_tables(table_name, stable_key)
  loop
    execute format(
      'update public.%I as target set server_seq = source.server_seq from kayamo_sync_sequence_backfill as source where source.table_name = %L and target.%I::text = source.stable_key',
      v_table,
      v_table,
      v_stable_key
    );
  end loop;
end;
$$;

insert into private.sync_user_counters (user_id, last_seq)
select user_id, max(server_seq)
from kayamo_sync_sequence_backfill
group by user_id
on conflict (user_id) do update
set last_seq = greatest(private.sync_user_counters.last_seq, excluded.last_seq);

drop table kayamo_sync_sequence_backfill;

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'food_entries', 'weight_logs', 'workouts', 'workout_sets',
    'workout_plans', 'workout_plan_exercises', 'meal_templates', 'tasks',
    'routines', 'routine_completions', 'agent_memory', 'coco_conversations',
    'coco_messages', 'goals', 'goal_milestones', 'habits',
    'habit_completions', 'companion_events', 'daily_plans', 'focus_sessions',
    'daily_loop_preferences', 'future_selves', 'compasses', 'inbox_items',
    'personal_rules'
  ]
  loop
    execute format('alter table public.%I alter column server_seq set not null', v_table);
    execute format(
      'alter table public.%I add constraint %I check (server_seq between 1 and 9007199254740991)',
      v_table,
      v_table || '_server_seq_check'
    );
  end loop;
end;
$$;

alter table public.exercises
  add constraint exercises_server_seq_owner_check
  check (
    (created_by is null and server_seq is null)
    or (created_by is not null and server_seq between 1 and 9007199254740991)
  );

do $$
declare
  v_table text;
  v_owner text;
begin
  for v_table, v_owner in
    select * from (values
      ('food_entries', 'user_id'),
      ('weight_logs', 'user_id'),
      ('workouts', 'user_id'),
      ('workout_sets', 'user_id'),
      ('exercises', 'created_by'),
      ('workout_plans', 'user_id'),
      ('workout_plan_exercises', 'user_id'),
      ('meal_templates', 'user_id'),
      ('tasks', 'user_id'),
      ('routines', 'user_id'),
      ('routine_completions', 'user_id'),
      ('agent_memory', 'user_id'),
      ('coco_conversations', 'user_id'),
      ('coco_messages', 'user_id'),
      ('goals', 'user_id'),
      ('goal_milestones', 'user_id'),
      ('habits', 'user_id'),
      ('habit_completions', 'user_id'),
      ('companion_events', 'user_id'),
      ('daily_plans', 'user_id'),
      ('focus_sessions', 'user_id'),
      ('daily_loop_preferences', 'user_id'),
      ('future_selves', 'user_id'),
      ('compasses', 'user_id'),
      ('inbox_items', 'user_id'),
      ('personal_rules', 'user_id')
    ) as sync_tables(table_name, owner_column)
  loop
    execute format(
      'create unique index %I on public.%I (%I, server_seq)',
      v_table || '_owner_server_seq_uidx',
      v_table,
      v_owner
    );
    execute format(
      'create trigger %I before insert or update on public.%I for each row execute function private.kayamo_assign_server_seq(%L)',
      'a_kayamo_assign_server_seq',
      v_table,
      v_owner
    );
  end loop;
end;
$$;

comment on table private.sync_user_counters is
  'Internal per-user serialization point for commit-ordered synchronization.';
comment on function private.kayamo_next_sync_seq(uuid) is
  'Allocates the authoritative per-user sync cursor inside the row mutation transaction.';

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'food_entries', 'weight_logs', 'workouts', 'workout_sets', 'exercises',
    'workout_plans', 'workout_plan_exercises', 'meal_templates', 'tasks',
    'routines', 'routine_completions', 'agent_memory', 'coco_conversations',
    'coco_messages', 'goals', 'goal_milestones', 'habits',
    'habit_completions', 'companion_events', 'daily_plans', 'focus_sessions',
    'daily_loop_preferences', 'future_selves', 'compasses', 'inbox_items',
    'personal_rules'
  ]
  loop
    execute format(
      'comment on column public.%I.server_seq is %L',
      v_table,
      'Authoritative commit-ordered synchronization cursor; never client-writable.'
    );
  end loop;
end;
$$;
