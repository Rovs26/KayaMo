-- Chapter 4 — core schema, triggers, RLS.
-- food_entries nutrient columns are a denormalized snapshot. Never replace
-- them with a join; correcting a food later must not rewrite history.
--
-- updated_at is the client last-write-wins field.
-- server_updated_at is the sync cursor only (trigger-maintained).

create extension if not exists pg_trgm with schema extensions;
create extension if not exists vector with schema extensions;

-- ── Functions ─────────────────────────────────────────────────────────────

create or replace function public.kayamo_logical_date(
  p_at timestamptz,
  p_tz text,
  p_day_starts_at time
) returns date
language sql
stable
set search_path = public
as $$
  select (
    (p_at at time zone coalesce(nullif(p_tz, ''), 'Asia/Manila'))
    - coalesce(p_day_starts_at, time '00:00')
  )::date;
$$;

create or replace function public.kayamo_touch_row()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.server_updated_at := now();
  if new.updated_at is null then
    new.updated_at := now();
  elsif new.updated_at > now() + interval '5 minutes' then
    new.updated_at := now();
  end if;
  if new.created_at is null then
    new.created_at := now();
  end if;
  return new;
end;
$$;

create or replace function public.kayamo_preserve_tombstone()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.deleted_at is not null then
    new.deleted_at := old.deleted_at;
  end if;
  return new;
end;
$$;

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

  -- Preserve the logical date assigned when the row was logged. Profile
  -- timezone/day-boundary changes are applied only by the explicit recompute
  -- function below, never as a side effect of an unrelated sync update.
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

create or replace function public.kayamo_on_auth_user_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, timezone, locale, day_starts_at, updated_at)
  values (new.id, 'Asia/Manila', 'taglish', time '00:00', now())
  on conflict (user_id) do nothing;
  return new;
end;
$$;

-- ── Tables ────────────────────────────────────────────────────────────────

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  sex text,
  birth_year integer,
  height_cm numeric(12, 4),
  activity_baseline numeric(12, 4),
  goal text,
  timezone text not null default 'Asia/Manila',
  locale text not null default 'taglish',
  day_starts_at time(0) not null default '00:00:00',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null,
  server_updated_at timestamptz not null default now(),
  constraint profiles_sex_check check (sex is null or sex in ('female', 'male')),
  constraint profiles_locale_check check (locale in ('en', 'fil', 'taglish')),
  constraint profiles_goal_check check (goal is null or goal in ('lose', 'maintain', 'gain'))
);

create table public.foods (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  source_id text,
  name text not null,
  name_tl text[] not null default '{}'::text[],
  brand text,
  barcode text,
  kcal numeric(12, 4) not null,
  protein_g numeric(12, 4) not null,
  carbs_g numeric(12, 4) not null,
  fat_g numeric(12, 4) not null,
  fiber_g numeric(12, 4) not null,
  sugar_g numeric(12, 4) not null,
  sodium_mg numeric(12, 4) not null,
  confidence numeric(3, 2) not null,
  verified_by_user boolean not null default false,
  created_by uuid references auth.users (id) on delete set null,
  shared boolean not null default false,
  attribution text,
  source_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null,
  server_updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint foods_source_check check (source in ('ph_core', 'usda_fdc', 'off', 'user', 'llm')),
  constraint foods_source_id_required check (source = 'user' or source_id is not null),
  constraint foods_confidence_check check (confidence >= 0 and confidence <= 1),
  constraint foods_user_created_by check (source <> 'user' or created_by is not null),
  constraint foods_source_source_id_key unique (source, source_id)
);

create table public.servings (
  id uuid primary key default gen_random_uuid(),
  food_id uuid not null references public.foods (id) on delete cascade,
  label text not null,
  grams_equivalent numeric(12, 4) not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null,
  server_updated_at timestamptz not null default now(),
  constraint servings_grams_positive check (grams_equivalent > 0),
  constraint servings_food_id_label_key unique (food_id, label)
);

create table public.food_aliases (
  id uuid primary key default gen_random_uuid(),
  food_id uuid not null references public.foods (id) on delete cascade,
  alias text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null,
  server_updated_at timestamptz not null default now()
);

create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  name text not null,
  name_tl text[] not null default '{}'::text[],
  shared boolean not null default false,
  promoted_food_id uuid references public.foods (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null,
  server_updated_at timestamptz not null default now()
);

create table public.recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  food_id uuid not null references public.foods (id) on delete restrict,
  quantity numeric(12, 4) not null,
  serving_id uuid references public.servings (id) on delete set null,
  prep_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null,
  server_updated_at timestamptz not null default now(),
  constraint recipe_ingredients_quantity_positive check (quantity > 0)
);

create table public.food_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  logged_at timestamptz not null,
  logical_date date not null,
  meal_slot text not null,
  food_id uuid references public.foods (id) on delete restrict,
  recipe_id uuid references public.recipes (id) on delete restrict,
  quantity numeric(12, 4) not null,
  serving_id uuid references public.servings (id) on delete set null,
  grams numeric(12, 4) not null,
  kcal numeric(12, 4) not null,
  protein_g numeric(12, 4) not null,
  carbs_g numeric(12, 4) not null,
  fat_g numeric(12, 4) not null,
  fiber_g numeric(12, 4) not null,
  sugar_g numeric(12, 4) not null,
  sodium_mg numeric(12, 4) not null,
  source text not null,
  confidence numeric(3, 2) not null,
  input_method text not null,
  photo_url text,
  raw_input text,
  food_name_snapshot text not null,
  serving_label_snapshot text,
  resolved_via text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null,
  server_updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint food_entries_source_check check (source in ('ph_core', 'usda_fdc', 'off', 'user', 'llm')),
  constraint food_entries_meal_slot_check check (meal_slot in ('almusal', 'tanghalian', 'hapunan', 'meryenda')),
  constraint food_entries_input_method_check check (input_method in ('search', 'chat', 'photo', 'barcode', 'quick')),
  constraint food_entries_resolved_via_check check (resolved_via in ('ph_core', 'usda_fdc', 'off', 'user', 'llm', 'recipe')),
  constraint food_entries_confidence_check check (confidence >= 0 and confidence <= 1),
  constraint food_entries_food_xor_recipe check (
    (food_id is not null and recipe_id is null)
    or (food_id is null and recipe_id is not null)
  ),
  constraint food_entries_quantity_positive check (quantity > 0),
  constraint food_entries_grams_positive check (grams > 0)
);

create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  name text not null,
  name_tl text[] not null default '{}'::text[],
  muscles text[] not null default '{}'::text[],
  equipment text,
  pattern text,
  unilateral boolean not null default false,
  default_rep_min integer,
  default_rep_max integer,
  created_by uuid references auth.users (id) on delete set null,
  shared boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null,
  server_updated_at timestamptz not null default now(),
  constraint exercises_source_check check (source in ('canonical', 'user')),
  constraint exercises_user_created_by check (source <> 'user' or created_by is not null)
);

create table public.workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  started_at timestamptz not null,
  ended_at timestamptz,
  logical_date date not null,
  notes text,
  routine_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null,
  server_updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.workout_sets (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null references public.workouts (id) on delete restrict,
  exercise_id uuid not null references public.exercises (id) on delete restrict,
  set_index integer not null,
  weight_kg numeric(12, 4) not null,
  reps integer not null,
  rpe numeric(12, 4),
  rir numeric(12, 4),
  is_warmup boolean not null default false,
  e1rm_epley_kg numeric(12, 4),
  e1rm_brzycki_kg numeric(12, 4),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null,
  server_updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint workout_sets_set_index_positive check (set_index >= 0),
  constraint workout_sets_reps_nonneg check (reps >= 0)
);

create table public.weight_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  logged_at timestamptz not null,
  measured_on date not null,
  logical_date date not null,
  weight_kg numeric(12, 4) not null,
  source text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null,
  server_updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint weight_logs_source_check check (source in ('manual', 'health_sync')),
  constraint weight_logs_weight_positive check (weight_kg > 0)
);

create table public.expenditure_estimates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  revision integer not null default 1,
  tdee_kcal numeric(12, 4) not null,
  ci_low numeric(12, 4),
  ci_high numeric(12, 4),
  method text not null,
  completeness numeric(12, 4),
  days_of_data integer,
  inputs_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null,
  server_updated_at timestamptz not null default now(),
  constraint expenditure_estimates_user_date_revision_key unique (user_id, date, revision),
  constraint expenditure_estimates_revision_positive check (revision >= 1)
);

create table public.targets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  effective_from date not null,
  kcal numeric(12, 4) not null,
  protein_g numeric(12, 4) not null,
  carbs_g numeric(12, 4) not null,
  fat_g numeric(12, 4) not null,
  day_type text not null,
  clamped boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null,
  server_updated_at timestamptz not null default now(),
  constraint targets_user_day_type_effective_from_key unique (user_id, day_type, effective_from),
  constraint targets_day_type_check check (day_type in ('training', 'rest', 'refeed', 'deload'))
);

create table public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  agent text not null,
  trigger text not null,
  input jsonb not null,
  output jsonb not null,
  model text not null,
  tokens integer not null default 0,
  cost_usd numeric(12, 6) not null default 0,
  latency_ms integer,
  scrubbed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null,
  server_updated_at timestamptz not null default now(),
  constraint agent_runs_tokens_nonneg check (tokens >= 0)
);

create table public.agent_memory (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null,
  content text not null,
  embedding extensions.vector(1536),
  embedding_model text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null,
  server_updated_at timestamptz not null default now()
);

-- ── Indexes ───────────────────────────────────────────────────────────────

create index foods_barcode_idx on public.foods (barcode);
create index foods_name_trgm_idx on public.foods using gin (name extensions.gin_trgm_ops);
create index foods_name_tl_gin_idx on public.foods using gin (name_tl);
create index foods_server_updated_at_idx on public.foods (server_updated_at);

create index servings_food_id_idx on public.servings (food_id);
create unique index servings_one_default_uidx on public.servings (food_id) where is_default = true;

create unique index food_aliases_food_alias_uidx on public.food_aliases (food_id, lower(alias));
create index food_aliases_alias_trgm_idx on public.food_aliases using gin (alias extensions.gin_trgm_ops);

create index recipes_user_id_idx on public.recipes (user_id);
create unique index recipes_system_name_uidx on public.recipes (name) where user_id is null;

create index recipe_ingredients_recipe_id_idx on public.recipe_ingredients (recipe_id);

create index food_entries_user_logged_at_idx on public.food_entries (user_id, logged_at desc);
create index food_entries_user_logical_date_idx on public.food_entries (user_id, logical_date);
create index food_entries_server_updated_at_idx on public.food_entries (server_updated_at);

create index exercises_name_trgm_idx on public.exercises using gin (name extensions.gin_trgm_ops);
create index exercises_name_tl_gin_idx on public.exercises using gin (name_tl);

create index workouts_user_started_at_idx on public.workouts (user_id, started_at desc);
create index workouts_user_logical_date_idx on public.workouts (user_id, logical_date);
create index workouts_server_updated_at_idx on public.workouts (server_updated_at);

create index workout_sets_workout_id_idx on public.workout_sets (workout_id, set_index);
create index workout_sets_server_updated_at_idx on public.workout_sets (server_updated_at);
create unique index workout_sets_live_index_uidx
  on public.workout_sets (workout_id, set_index)
  where deleted_at is null;

create unique index weight_logs_user_measured_source_live_uidx
  on public.weight_logs (user_id, measured_on, source)
  where deleted_at is null;
create index weight_logs_user_logical_date_idx on public.weight_logs (user_id, logical_date);
create index weight_logs_server_updated_at_idx on public.weight_logs (server_updated_at);

create index expenditure_estimates_user_date_idx on public.expenditure_estimates (user_id, date);

create index agent_runs_user_created_at_idx on public.agent_runs (user_id, created_at desc);

create index agent_memory_user_kind_idx on public.agent_memory (user_id, kind);
create index agent_memory_embedding_hnsw_idx
  on public.agent_memory
  using hnsw (embedding extensions.vector_cosine_ops);

-- ── Triggers ──────────────────────────────────────────────────────────────

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.kayamo_on_auth_user_created();

create trigger profiles_touch before insert or update on public.profiles
  for each row execute function public.kayamo_touch_row();
create trigger foods_touch before insert or update on public.foods
  for each row execute function public.kayamo_touch_row();
create trigger servings_touch before insert or update on public.servings
  for each row execute function public.kayamo_touch_row();
create trigger food_aliases_touch before insert or update on public.food_aliases
  for each row execute function public.kayamo_touch_row();
create trigger recipes_touch before insert or update on public.recipes
  for each row execute function public.kayamo_touch_row();
create trigger recipe_ingredients_touch before insert or update on public.recipe_ingredients
  for each row execute function public.kayamo_touch_row();
create trigger food_entries_touch before insert or update on public.food_entries
  for each row execute function public.kayamo_touch_row();
create trigger exercises_touch before insert or update on public.exercises
  for each row execute function public.kayamo_touch_row();
create trigger workouts_touch before insert or update on public.workouts
  for each row execute function public.kayamo_touch_row();
create trigger workout_sets_touch before insert or update on public.workout_sets
  for each row execute function public.kayamo_touch_row();
create trigger weight_logs_touch before insert or update on public.weight_logs
  for each row execute function public.kayamo_touch_row();
create trigger expenditure_estimates_touch before insert or update on public.expenditure_estimates
  for each row execute function public.kayamo_touch_row();
create trigger targets_touch before insert or update on public.targets
  for each row execute function public.kayamo_touch_row();
create trigger agent_runs_touch before insert or update on public.agent_runs
  for each row execute function public.kayamo_touch_row();
create trigger agent_memory_touch before insert or update on public.agent_memory
  for each row execute function public.kayamo_touch_row();

create trigger foods_preserve_tombstone before update on public.foods
  for each row execute function public.kayamo_preserve_tombstone();
create trigger food_entries_preserve_tombstone before update on public.food_entries
  for each row execute function public.kayamo_preserve_tombstone();
create trigger workouts_preserve_tombstone before update on public.workouts
  for each row execute function public.kayamo_preserve_tombstone();
create trigger workout_sets_preserve_tombstone before update on public.workout_sets
  for each row execute function public.kayamo_preserve_tombstone();
create trigger weight_logs_preserve_tombstone before update on public.weight_logs
  for each row execute function public.kayamo_preserve_tombstone();

create trigger food_entries_set_logical_date before insert or update on public.food_entries
  for each row execute function public.kayamo_set_logical_date();
create trigger weight_logs_set_logical_date before insert or update on public.weight_logs
  for each row execute function public.kayamo_set_logical_date();
create trigger workouts_set_logical_date before insert or update on public.workouts
  for each row execute function public.kayamo_set_logical_date();

-- ── RLS ───────────────────────────────────────────────────────────────────

alter table public.profiles enable row level security;
alter table public.foods enable row level security;
alter table public.servings enable row level security;
alter table public.food_aliases enable row level security;
alter table public.recipes enable row level security;
alter table public.recipe_ingredients enable row level security;
alter table public.food_entries enable row level security;
alter table public.exercises enable row level security;
alter table public.workouts enable row level security;
alter table public.workout_sets enable row level security;
alter table public.weight_logs enable row level security;
alter table public.expenditure_estimates enable row level security;
alter table public.targets enable row level security;
alter table public.agent_runs enable row level security;
alter table public.agent_memory enable row level security;

-- profiles
create policy profiles_select on public.profiles for select to authenticated
  using (user_id = auth.uid());
create policy profiles_insert on public.profiles for insert to authenticated
  with check (user_id = auth.uid());
create policy profiles_update on public.profiles for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- foods: canonical readable when authenticated; user foods private unless shared.
-- Tombstones are hidden. Writes only for the owner's user-source rows.
create policy foods_select on public.foods for select to authenticated
  using (
    deleted_at is null
    and (
      source <> 'user'
      or created_by = auth.uid()
      or shared = true
    )
  );
create policy foods_insert on public.foods for insert to authenticated
  with check (
    source = 'user'
    and created_by = auth.uid()
    and deleted_at is null
  );
create policy foods_update on public.foods for update to authenticated
  using (
    source = 'user'
    and created_by = auth.uid()
    and deleted_at is null
  )
  with check (
    source = 'user'
    and created_by = auth.uid()
  );

-- servings follow parent food visibility / ownership.
create policy servings_select on public.servings for select to authenticated
  using (
    exists (
      select 1 from public.foods f
      where f.id = servings.food_id
        and f.deleted_at is null
        and (f.source <> 'user' or f.created_by = auth.uid() or f.shared = true)
    )
  );
create policy servings_insert on public.servings for insert to authenticated
  with check (
    exists (
      select 1 from public.foods f
      where f.id = servings.food_id
        and f.source = 'user'
        and f.created_by = auth.uid()
        and f.deleted_at is null
    )
  );
create policy servings_update on public.servings for update to authenticated
  using (
    exists (
      select 1 from public.foods f
      where f.id = servings.food_id
        and f.source = 'user'
        and f.created_by = auth.uid()
        and f.deleted_at is null
    )
  )
  with check (
    exists (
      select 1 from public.foods f
      where f.id = servings.food_id
        and f.source = 'user'
        and f.created_by = auth.uid()
        and f.deleted_at is null
    )
  );
create policy servings_delete on public.servings for delete to authenticated
  using (
    exists (
      select 1 from public.foods f
      where f.id = servings.food_id
        and f.source = 'user'
        and f.created_by = auth.uid()
        and f.deleted_at is null
    )
  );

-- food_aliases
create policy food_aliases_select on public.food_aliases for select to authenticated
  using (
    exists (
      select 1 from public.foods f
      where f.id = food_aliases.food_id
        and f.deleted_at is null
        and (f.source <> 'user' or f.created_by = auth.uid() or f.shared = true)
    )
  );
create policy food_aliases_insert on public.food_aliases for insert to authenticated
  with check (
    exists (
      select 1 from public.foods f
      where f.id = food_aliases.food_id
        and f.source = 'user'
        and f.created_by = auth.uid()
        and f.deleted_at is null
    )
  );
create policy food_aliases_update on public.food_aliases for update to authenticated
  using (
    exists (
      select 1 from public.foods f
      where f.id = food_aliases.food_id
        and f.source = 'user'
        and f.created_by = auth.uid()
        and f.deleted_at is null
    )
  )
  with check (
    exists (
      select 1 from public.foods f
      where f.id = food_aliases.food_id
        and f.source = 'user'
        and f.created_by = auth.uid()
        and f.deleted_at is null
    )
  );
create policy food_aliases_delete on public.food_aliases for delete to authenticated
  using (
    exists (
      select 1 from public.foods f
      where f.id = food_aliases.food_id
        and f.source = 'user'
        and f.created_by = auth.uid()
        and f.deleted_at is null
    )
  );

-- recipes: owner, system templates (user_id is null), or shared.
create policy recipes_select on public.recipes for select to authenticated
  using (user_id = auth.uid() or user_id is null or shared = true);
create policy recipes_insert on public.recipes for insert to authenticated
  with check (user_id = auth.uid());
create policy recipes_update on public.recipes for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
create policy recipes_delete on public.recipes for delete to authenticated
  using (user_id = auth.uid());

create policy recipe_ingredients_select on public.recipe_ingredients for select to authenticated
  using (
    exists (
      select 1 from public.recipes r
      where r.id = recipe_ingredients.recipe_id
        and (r.user_id = auth.uid() or r.user_id is null or r.shared = true)
    )
  );
create policy recipe_ingredients_insert on public.recipe_ingredients for insert to authenticated
  with check (
    exists (
      select 1 from public.recipes r
      where r.id = recipe_ingredients.recipe_id
        and r.user_id = auth.uid()
    )
  );
create policy recipe_ingredients_update on public.recipe_ingredients for update to authenticated
  using (
    exists (
      select 1 from public.recipes r
      where r.id = recipe_ingredients.recipe_id
        and r.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.recipes r
      where r.id = recipe_ingredients.recipe_id
        and r.user_id = auth.uid()
    )
  );
create policy recipe_ingredients_delete on public.recipe_ingredients for delete to authenticated
  using (
    exists (
      select 1 from public.recipes r
      where r.id = recipe_ingredients.recipe_id
        and r.user_id = auth.uid()
    )
  );

-- food_entries: own live rows. INSERT may carry a tombstone (offline delete
-- that never synced the original). UPDATE of live rows may set deleted_at.
-- Once tombstoned, USING hides the row so a stale upsert cannot resurrect it;
-- the preserve-tombstone trigger is belt-and-suspenders.
create policy food_entries_select on public.food_entries for select to authenticated
  using (user_id = auth.uid() and deleted_at is null);
create policy food_entries_insert on public.food_entries for insert to authenticated
  with check (user_id = auth.uid());
create policy food_entries_update on public.food_entries for update to authenticated
  using (user_id = auth.uid() and deleted_at is null)
  with check (user_id = auth.uid());

-- exercises
create policy exercises_select on public.exercises for select to authenticated
  using (source <> 'user' or created_by = auth.uid() or shared = true);
create policy exercises_insert on public.exercises for insert to authenticated
  with check (source = 'user' and created_by = auth.uid());
create policy exercises_update on public.exercises for update to authenticated
  using (source = 'user' and created_by = auth.uid())
  with check (source = 'user' and created_by = auth.uid());
create policy exercises_delete on public.exercises for delete to authenticated
  using (source = 'user' and created_by = auth.uid());

-- workouts
create policy workouts_select on public.workouts for select to authenticated
  using (user_id = auth.uid() and deleted_at is null);
create policy workouts_insert on public.workouts for insert to authenticated
  with check (user_id = auth.uid());
create policy workouts_update on public.workouts for update to authenticated
  using (user_id = auth.uid() and deleted_at is null)
  with check (user_id = auth.uid());

create policy workout_sets_select on public.workout_sets for select to authenticated
  using (
    deleted_at is null
    and exists (
      select 1 from public.workouts w
      where w.id = workout_sets.workout_id
        and w.user_id = auth.uid()
        and w.deleted_at is null
    )
  );
create policy workout_sets_insert on public.workout_sets for insert to authenticated
  with check (
    exists (
      select 1 from public.workouts w
      where w.id = workout_sets.workout_id
        and w.user_id = auth.uid()
        and w.deleted_at is null
    )
  );
create policy workout_sets_update on public.workout_sets for update to authenticated
  using (
    deleted_at is null
    and exists (
      select 1 from public.workouts w
      where w.id = workout_sets.workout_id
        and w.user_id = auth.uid()
        and w.deleted_at is null
    )
  )
  with check (
    exists (
      select 1 from public.workouts w
      where w.id = workout_sets.workout_id
        and w.user_id = auth.uid()
    )
  );

-- weight_logs
create policy weight_logs_select on public.weight_logs for select to authenticated
  using (user_id = auth.uid() and deleted_at is null);
create policy weight_logs_insert on public.weight_logs for insert to authenticated
  with check (user_id = auth.uid());
create policy weight_logs_update on public.weight_logs for update to authenticated
  using (user_id = auth.uid() and deleted_at is null)
  with check (user_id = auth.uid());

-- expenditure_estimates: insert-only (new revision), never update in place
create policy expenditure_estimates_select on public.expenditure_estimates for select to authenticated
  using (user_id = auth.uid());
create policy expenditure_estimates_insert on public.expenditure_estimates for insert to authenticated
  with check (user_id = auth.uid());

-- targets: insert-only versioned rows
create policy targets_select on public.targets for select to authenticated
  using (user_id = auth.uid());
create policy targets_insert on public.targets for insert to authenticated
  with check (user_id = auth.uid());

-- agent_runs (own rows, including scrubbed_at updates)
create policy agent_runs_select on public.agent_runs for select to authenticated
  using (user_id = auth.uid());
create policy agent_runs_insert on public.agent_runs for insert to authenticated
  with check (user_id = auth.uid());
create policy agent_runs_update on public.agent_runs for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy agent_memory_select on public.agent_memory for select to authenticated
  using (user_id = auth.uid());
create policy agent_memory_insert on public.agent_memory for insert to authenticated
  with check (user_id = auth.uid());
create policy agent_memory_update on public.agent_memory for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
create policy agent_memory_delete on public.agent_memory for delete to authenticated
  using (user_id = auth.uid());

-- ── Grants: authenticated only. Anon has no table access. ─────────────────

revoke all on all tables in schema public from public, anon;
revoke all on all sequences in schema public from public, anon;
revoke all on all functions in schema public from public, anon;

grant usage on schema public to authenticated, anon, service_role;

grant select, insert, update, delete on all tables in schema public to authenticated;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to authenticated, service_role;
grant execute on all functions in schema public to authenticated, service_role;

revoke all on function public.kayamo_recompute_logical_dates() from public, anon;
grant execute on function public.kayamo_recompute_logical_dates() to authenticated, service_role;

-- Hard DELETE cannot propagate through last-write-wins. Tombstone instead.
revoke delete on public.foods, public.food_entries, public.weight_logs,
  public.workouts, public.workout_sets from authenticated;

-- Versioned tables are insert-only for the user role.
revoke update, delete on public.targets, public.expenditure_estimates from authenticated;
