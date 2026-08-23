-- Harden sync invariants for databases that already applied 0001.
-- server_updated_at remains trigger-owned and is used only for sync cursors.

create index if not exists workout_sets_server_updated_at_idx
  on public.workout_sets (server_updated_at);

create or replace function public.kayamo_set_logical_date()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  tz text;
  start_at time;
  at timestamptz;
begin
  -- The explicit owner-invoked recompute RPC sets this transaction-local
  -- flag. Ordinary REST writes cannot use logical_date as a writable field.
  if current_setting('kayamo.logical_date_recompute', true) = 'on' then
    return new;
  end if;

  -- Do not silently re-bucket a historical row after the profile timezone or
  -- day boundary changes. Only a source-instant/user change recomputes here.
  if tg_op = 'UPDATE' then
    if tg_table_name = 'workouts' then
      if new.user_id is not distinct from old.user_id
        and new.started_at is not distinct from old.started_at then
        new.logical_date := old.logical_date;
        return new;
      end if;
    elsif new.user_id is not distinct from old.user_id
      and new.logged_at is not distinct from old.logged_at then
      new.logical_date := old.logical_date;
      return new;
    end if;
  end if;

  select p.timezone, p.day_starts_at
    into tz, start_at
  from public.profiles p
  where p.user_id = new.user_id;

  if tg_table_name = 'workouts' then
    at := new.started_at;
  else
    at := new.logged_at;
  end if;

  new.logical_date := public.kayamo_logical_date(at, tz, start_at);
  return new;
end;
$$;

create or replace function public.kayamo_recompute_logical_dates()
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_tz text;
  v_start_at time;
  v_food_entries integer;
  v_weight_logs integer;
  v_workouts integer;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select p.timezone, p.day_starts_at
    into strict v_tz, v_start_at
  from public.profiles p
  where p.user_id = v_user_id;

  perform set_config('kayamo.logical_date_recompute', 'on', true);

  update public.food_entries fe
  set logical_date = public.kayamo_logical_date(fe.logged_at, v_tz, v_start_at)
  where fe.user_id = v_user_id
    and fe.deleted_at is null
    and fe.logical_date is distinct from public.kayamo_logical_date(fe.logged_at, v_tz, v_start_at);
  get diagnostics v_food_entries = row_count;

  update public.weight_logs wl
  set logical_date = public.kayamo_logical_date(wl.logged_at, v_tz, v_start_at)
  where wl.user_id = v_user_id
    and wl.deleted_at is null
    and wl.logical_date is distinct from public.kayamo_logical_date(wl.logged_at, v_tz, v_start_at);
  get diagnostics v_weight_logs = row_count;

  update public.workouts w
  set logical_date = public.kayamo_logical_date(w.started_at, v_tz, v_start_at)
  where w.user_id = v_user_id
    and w.deleted_at is null
    and w.logical_date is distinct from public.kayamo_logical_date(w.started_at, v_tz, v_start_at);
  get diagnostics v_workouts = row_count;

  perform set_config('kayamo.logical_date_recompute', 'off', true);

  return jsonb_build_object(
    'food_entries', v_food_entries,
    'weight_logs', v_weight_logs,
    'workouts', v_workouts
  );
end;
$$;

revoke all on function public.kayamo_recompute_logical_dates() from public, anon;
grant execute on function public.kayamo_recompute_logical_dates() to authenticated, service_role;
