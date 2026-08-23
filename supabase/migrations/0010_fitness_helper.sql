-- Bundle 4 fitness helper. Workout plans, active sessions, form references,
-- stored e1RM, and offline sync all follow the server-cursor/LWW/tombstone contract.

alter table public.exercises
  add column secondary_muscles text[] not null default '{}'::text[],
  add column form_cues text[] not null default '{}'::text[],
  add column common_mistakes text[] not null default '{}'::text[],
  add column media_url text,
  add column media_type text,
  add column media_license text,
  add column media_attribution text,
  add column deleted_at timestamptz,
  add constraint exercises_rep_range_check check (
    default_rep_min is null or default_rep_max is null
      or default_rep_min <= default_rep_max
  ),
  add constraint exercises_media_type_check check (
    media_type is null or media_type in ('image', 'video')
  );

create table public.workout_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null,
  server_updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint workout_plans_title_len
    check (char_length(trim(title)) between 1 and 120)
);

create table public.workout_plan_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  plan_id uuid not null references public.workout_plans (id) on delete restrict,
  exercise_id uuid not null references public.exercises (id) on delete restrict,
  day_index integer not null,
  exercise_order integer not null,
  target_sets integer not null,
  rep_min integer not null,
  rep_max integer not null,
  rest_seconds integer not null default 120,
  superset_group text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null,
  server_updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint workout_plan_exercises_day_check check (day_index between 0 and 6),
  constraint workout_plan_exercises_order_check check (exercise_order >= 0),
  constraint workout_plan_exercises_sets_check check (target_sets > 0),
  constraint workout_plan_exercises_reps_check
    check (rep_min > 0 and rep_max >= rep_min),
  constraint workout_plan_exercises_rest_check check (rest_seconds >= 0)
);

create index workout_plans_user_active_idx
  on public.workout_plans (user_id, active);
create index workout_plans_server_updated_at_idx
  on public.workout_plans (server_updated_at);
create index workout_plan_exercises_plan_day_idx
  on public.workout_plan_exercises (plan_id, day_index, exercise_order);
create index workout_plan_exercises_server_updated_at_idx
  on public.workout_plan_exercises (server_updated_at);
create unique index workout_plan_exercises_live_order_uidx
  on public.workout_plan_exercises (plan_id, day_index, exercise_order)
  where deleted_at is null;

alter table public.workouts
  add column plan_id uuid references public.workout_plans (id) on delete restrict,
  add column plan_day_index integer,
  add column status text not null default 'active',
  add column is_deload boolean not null default false,
  add constraint workouts_status_check
    check (status in ('active', 'completed', 'abandoned')),
  add constraint workouts_plan_day_check
    check (plan_day_index is null or plan_day_index between 0 and 6);

alter table public.workout_sets
  add column user_id uuid,
  add column exercise_order integer not null default 0,
  add column exercise_name_snapshot text,
  add column set_type text not null default 'normal',
  add column superset_group text,
  add column completed_at timestamptz,
  add column rest_seconds integer,
  add column e1rm_low_confidence boolean not null default false;

update public.workout_sets s
set user_id = w.user_id,
    exercise_name_snapshot = e.name,
    set_type = case when s.is_warmup then 'warmup' else 'normal' end
from public.workouts w, public.exercises e
where w.id = s.workout_id and e.id = s.exercise_id;

alter table public.workout_sets
  alter column user_id set not null,
  alter column exercise_name_snapshot set not null,
  add constraint workout_sets_user_id_fkey
    foreign key (user_id) references auth.users (id) on delete cascade,
  add constraint workout_sets_weight_nonneg check (weight_kg >= 0),
  add constraint workout_sets_rpe_range check (rpe is null or rpe between 1 and 10),
  add constraint workout_sets_rir_range check (rir is null or rir between 0 and 10),
  add constraint workout_sets_type_check
    check (set_type in ('warmup', 'normal', 'dropset')),
  add constraint workout_sets_rest_check
    check (rest_seconds is null or rest_seconds >= 0);

drop index public.workout_sets_workout_id_idx;
drop index public.workout_sets_live_index_uidx;
create index workout_sets_workout_id_idx
  on public.workout_sets (workout_id, exercise_order, set_index);
create index workout_sets_user_id_idx on public.workout_sets (user_id);
create unique index workout_sets_live_index_uidx
  on public.workout_sets (workout_id, exercise_id, set_index)
  where deleted_at is null;

-- The owner and exercise snapshot are derived from confirmed server records.
-- A client cannot assign another owner or silently rename historical sets.
create or replace function public.kayamo_prepare_workout_set()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_user_id uuid;
  v_exercise_name text;
begin
  if tg_op = 'UPDATE' and new.workout_id is not distinct from old.workout_id then
    new.user_id := old.user_id;
  else
    select w.user_id into v_user_id
    from public.workouts w
    where w.id = new.workout_id and w.deleted_at is null;
    if v_user_id is null then
      raise exception 'live workout not found' using errcode = '23503';
    end if;
    new.user_id := v_user_id;
  end if;

  if tg_op = 'INSERT' or new.exercise_id is distinct from old.exercise_id then
    select e.name into v_exercise_name
    from public.exercises e
    where e.id = new.exercise_id and e.deleted_at is null;
    if v_exercise_name is null then
      raise exception 'live exercise not found' using errcode = '23503';
    end if;
    new.exercise_name_snapshot := v_exercise_name;
  else
    new.exercise_name_snapshot := old.exercise_name_snapshot;
  end if;

  new.is_warmup := new.set_type = 'warmup';
  return new;
end;
$$;

create or replace function public.kayamo_tombstone_workout_sets()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.deleted_at is null and new.deleted_at is not null then
    update public.workout_sets
    set deleted_at = coalesce(deleted_at, new.deleted_at),
        updated_at = greatest(updated_at, new.updated_at)
    where workout_id = new.id and deleted_at is null;
  end if;
  return new;
end;
$$;

-- Brzycki is deliberately stored rather than generated. Formula values only
-- change when their source set changes; unrelated edits preserve the snapshot.
create or replace function public.kayamo_store_workout_set_e1rm()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
    and new.weight_kg is not distinct from old.weight_kg
    and new.reps is not distinct from old.reps then
    new.e1rm_epley_kg := old.e1rm_epley_kg;
    new.e1rm_brzycki_kg := old.e1rm_brzycki_kg;
    new.e1rm_low_confidence := old.e1rm_low_confidence;
    return new;
  end if;

  if new.weight_kg <= 0 or new.reps <= 0 then
    new.e1rm_epley_kg := null;
    new.e1rm_brzycki_kg := null;
  elsif new.reps = 1 then
    new.e1rm_epley_kg := new.weight_kg;
    new.e1rm_brzycki_kg := new.weight_kg;
  else
    new.e1rm_epley_kg := round(new.weight_kg * (1 + new.reps / 30.0), 4);
    new.e1rm_brzycki_kg := case
      when new.reps < 37 then round(new.weight_kg * 36.0 / (37 - new.reps), 4)
      else null
    end;
  end if;
  new.e1rm_low_confidence := new.reps > 12;
  return new;
end;
$$;

create trigger workout_sets_prepare before insert or update
  on public.workout_sets for each row
  execute function public.kayamo_prepare_workout_set();
create trigger workout_sets_store_e1rm before insert or update
  on public.workout_sets for each row
  execute function public.kayamo_store_workout_set_e1rm();
create trigger workouts_tombstone_sets after update of deleted_at
  on public.workouts for each row
  execute function public.kayamo_tombstone_workout_sets();

create trigger exercises_preserve_tombstone before update on public.exercises
  for each row execute function public.kayamo_preserve_tombstone();
create trigger workout_plans_touch before insert or update on public.workout_plans
  for each row execute function public.kayamo_touch_row();
create trigger workout_plan_exercises_touch before insert or update
  on public.workout_plan_exercises for each row execute function public.kayamo_touch_row();
create trigger workout_plans_preserve_tombstone before update on public.workout_plans
  for each row execute function public.kayamo_preserve_tombstone();
create trigger workout_plan_exercises_preserve_tombstone before update
  on public.workout_plan_exercises for each row
  execute function public.kayamo_preserve_tombstone();

alter table public.workout_plans enable row level security;
alter table public.workout_plan_exercises enable row level security;

drop policy exercises_select on public.exercises;
drop policy exercises_update on public.exercises;
drop policy exercises_delete on public.exercises;
create policy exercises_select on public.exercises for select to authenticated
  using (
    deleted_at is null
    and (source <> 'user' or created_by = auth.uid() or shared = true)
  );
create policy exercises_update on public.exercises for update to authenticated
  using (source = 'user' and created_by = auth.uid() and deleted_at is null)
  with check (source = 'user' and created_by = auth.uid());

drop policy workouts_insert on public.workouts;
drop policy workouts_update on public.workouts;
create policy workouts_insert on public.workouts for insert to authenticated
  with check (
    user_id = auth.uid()
    and (
      plan_id is null or exists (
        select 1 from public.workout_plans p
        where p.id = workouts.plan_id
          and p.user_id = auth.uid() and p.deleted_at is null
      )
    )
  );
create policy workouts_update on public.workouts for update to authenticated
  using (user_id = auth.uid() and deleted_at is null)
  with check (
    user_id = auth.uid()
    and (
      plan_id is null or exists (
        select 1 from public.workout_plans p
        where p.id = workouts.plan_id and p.user_id = auth.uid()
      )
    )
  );

drop policy workout_sets_select on public.workout_sets;
drop policy workout_sets_insert on public.workout_sets;
drop policy workout_sets_update on public.workout_sets;
create policy workout_sets_select on public.workout_sets for select to authenticated
  using (
    user_id = auth.uid() and deleted_at is null
    and exists (
      select 1 from public.workouts w
      where w.id = workout_sets.workout_id
        and w.user_id = auth.uid() and w.deleted_at is null
    )
  );
create policy workout_sets_insert on public.workout_sets for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.workouts w
      where w.id = workout_sets.workout_id
        and w.user_id = auth.uid() and w.deleted_at is null
    )
  );
create policy workout_sets_update on public.workout_sets for update to authenticated
  using (
    user_id = auth.uid() and deleted_at is null
    and exists (
      select 1 from public.workouts w
      where w.id = workout_sets.workout_id
        and w.user_id = auth.uid() and w.deleted_at is null
    )
  )
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.workouts w
      where w.id = workout_sets.workout_id and w.user_id = auth.uid()
    )
  );

create policy workout_plans_select on public.workout_plans for select to authenticated
  using (user_id = auth.uid() and deleted_at is null);
create policy workout_plans_insert on public.workout_plans for insert to authenticated
  with check (user_id = auth.uid());
create policy workout_plans_update on public.workout_plans for update to authenticated
  using (user_id = auth.uid() and deleted_at is null)
  with check (user_id = auth.uid());

create policy workout_plan_exercises_select on public.workout_plan_exercises
  for select to authenticated
  using (user_id = auth.uid() and deleted_at is null);
create policy workout_plan_exercises_insert on public.workout_plan_exercises
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.workout_plans p
      where p.id = workout_plan_exercises.plan_id
        and p.user_id = auth.uid() and p.deleted_at is null
    )
  );
create policy workout_plan_exercises_update on public.workout_plan_exercises
  for update to authenticated
  using (user_id = auth.uid() and deleted_at is null)
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.workout_plans p
      where p.id = workout_plan_exercises.plan_id
        and p.user_id = auth.uid()
    )
  );

revoke all on public.workout_plans, public.workout_plan_exercises from public, anon;
grant select, insert, update on public.workout_plans, public.workout_plan_exercises
  to authenticated;
grant all on public.workout_plans, public.workout_plan_exercises to service_role;
revoke delete on public.exercises, public.workout_plans, public.workout_plan_exercises
  from authenticated;

revoke all on function public.kayamo_prepare_workout_set() from public, anon;
revoke all on function public.kayamo_store_workout_set_e1rm() from public, anon;
revoke all on function public.kayamo_tombstone_workout_sets() from public, anon;
grant execute on function public.kayamo_prepare_workout_set()
  to authenticated, service_role;
grant execute on function public.kayamo_store_workout_set_e1rm()
  to authenticated, service_role;
grant execute on function public.kayamo_tombstone_workout_sets()
  to authenticated, service_role;
