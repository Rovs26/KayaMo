-- Bundle 1 planning foundation. These records follow the existing KayaMo
-- offline contract: updated_at is client LWW, server_updated_at is a
-- trigger-owned cursor, and deleted_at is an irreversible tombstone.

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  notes text,
  scheduled_for date,
  due_at timestamptz,
  completed_at timestamptz,
  sort_order integer not null default 0,
  origin text not null default 'user',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null,
  server_updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint tasks_title_len check (char_length(trim(title)) between 1 and 160),
  constraint tasks_sort_order_nonneg check (sort_order >= 0),
  constraint tasks_origin_check check (origin in ('user', 'coco_confirmed'))
);

create table public.routines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  notes text,
  schedule_days integer[] not null default array[0,1,2,3,4,5,6]::integer[],
  preferred_time time(0),
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null,
  server_updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint routines_title_len check (char_length(trim(title)) between 1 and 120),
  constraint routines_schedule_days_nonempty check (cardinality(schedule_days) >= 1),
  constraint routines_schedule_days_range check (
    schedule_days <@ array[0,1,2,3,4,5,6]::integer[]
  ),
  constraint routines_sort_order_nonneg check (sort_order >= 0)
);

create table public.routine_completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  routine_id uuid not null references public.routines (id) on delete restrict,
  logical_date date not null,
  completed_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null,
  server_updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index tasks_user_scheduled_for_idx on public.tasks (user_id, scheduled_for);
create index tasks_server_updated_at_idx on public.tasks (server_updated_at);
create index routines_user_active_idx on public.routines (user_id, active);
create index routines_server_updated_at_idx on public.routines (server_updated_at);
create index routine_completions_user_logical_date_idx
  on public.routine_completions (user_id, logical_date);
create index routine_completions_server_updated_at_idx
  on public.routine_completions (server_updated_at);
create unique index routine_completions_live_day_uidx
  on public.routine_completions (routine_id, logical_date)
  where deleted_at is null;

create trigger tasks_touch before insert or update on public.tasks
  for each row execute function public.kayamo_touch_row();
create trigger routines_touch before insert or update on public.routines
  for each row execute function public.kayamo_touch_row();
create trigger routine_completions_touch before insert or update on public.routine_completions
  for each row execute function public.kayamo_touch_row();

create trigger tasks_preserve_tombstone before update on public.tasks
  for each row execute function public.kayamo_preserve_tombstone();
create trigger routines_preserve_tombstone before update on public.routines
  for each row execute function public.kayamo_preserve_tombstone();
create trigger routine_completions_preserve_tombstone before update on public.routine_completions
  for each row execute function public.kayamo_preserve_tombstone();

alter table public.tasks enable row level security;
alter table public.routines enable row level security;
alter table public.routine_completions enable row level security;

create policy tasks_select on public.tasks for select to authenticated
  using (user_id = auth.uid() and deleted_at is null);
create policy tasks_insert on public.tasks for insert to authenticated
  with check (user_id = auth.uid());
create policy tasks_update on public.tasks for update to authenticated
  using (user_id = auth.uid() and deleted_at is null)
  with check (user_id = auth.uid());

create policy routines_select on public.routines for select to authenticated
  using (user_id = auth.uid() and deleted_at is null);
create policy routines_insert on public.routines for insert to authenticated
  with check (user_id = auth.uid());
create policy routines_update on public.routines for update to authenticated
  using (user_id = auth.uid() and deleted_at is null)
  with check (user_id = auth.uid());

create policy routine_completions_select on public.routine_completions
  for select to authenticated
  using (user_id = auth.uid() and deleted_at is null);
create policy routine_completions_insert on public.routine_completions
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.routines r
      where r.id = routine_completions.routine_id
        and r.user_id = auth.uid()
        and r.deleted_at is null
    )
  );
create policy routine_completions_update on public.routine_completions
  for update to authenticated
  using (user_id = auth.uid() and deleted_at is null)
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.routines r
      where r.id = routine_completions.routine_id
        and r.user_id = auth.uid()
    )
  );

revoke all on public.tasks, public.routines, public.routine_completions from public, anon;
grant select, insert, update on public.tasks, public.routines, public.routine_completions
  to authenticated;
grant all on public.tasks, public.routines, public.routine_completions to service_role;
