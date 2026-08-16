-- Named meal templates for one-tap logging. Items are a JSON array of
-- denormalized snapshots so a template can log offline without a food join.

create table public.meal_templates (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  items jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null,
  server_updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint meal_templates_name_len check (char_length(name) between 1 and 80),
  constraint meal_templates_items_array check (jsonb_typeof(items) = 'array'),
  constraint meal_templates_items_min check (jsonb_array_length(items) >= 1)
);

create index meal_templates_user_id_idx on public.meal_templates (user_id);
create index meal_templates_server_updated_at_idx on public.meal_templates (server_updated_at);

create trigger meal_templates_touch before insert or update on public.meal_templates
  for each row execute function public.kayamo_touch_row();

create trigger meal_templates_preserve_tombstone before update on public.meal_templates
  for each row execute function public.kayamo_preserve_tombstone();

alter table public.meal_templates enable row level security;

create policy meal_templates_select on public.meal_templates for select to authenticated
  using (user_id = auth.uid() and deleted_at is null);
create policy meal_templates_insert on public.meal_templates for insert to authenticated
  with check (user_id = auth.uid());
create policy meal_templates_update on public.meal_templates for update to authenticated
  using (user_id = auth.uid() and deleted_at is null)
  with check (user_id = auth.uid());

grant select, insert, update, delete on public.meal_templates to authenticated;
grant all on public.meal_templates to service_role;
revoke delete on public.meal_templates from authenticated;
