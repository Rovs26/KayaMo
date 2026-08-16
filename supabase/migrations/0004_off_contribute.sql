-- Opt-in queue for contributing a user food to Open Food Facts.
-- Separate from foods.shared (KayaMo community). Never pre-ticked.

create table public.off_contribute_requests (
  id uuid primary key default gen_random_uuid(),
  food_id uuid not null references public.foods (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'queued',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null,
  server_updated_at timestamptz not null default now(),
  constraint off_contribute_requests_food_uidx unique (food_id),
  constraint off_contribute_status_check check (status in ('queued', 'sent', 'skipped'))
);

create index off_contribute_requests_user_idx on public.off_contribute_requests (user_id);

create trigger off_contribute_requests_touch before insert or update on public.off_contribute_requests
  for each row execute function public.kayamo_touch_row();

alter table public.off_contribute_requests enable row level security;

create policy off_contribute_select on public.off_contribute_requests for select to authenticated
  using (user_id = auth.uid());
create policy off_contribute_insert on public.off_contribute_requests for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.foods f
      where f.id = off_contribute_requests.food_id
        and f.source = 'user'
        and f.created_by = auth.uid()
    )
  );

grant select, insert, update, delete on public.off_contribute_requests to authenticated;
grant all on public.off_contribute_requests to service_role;
revoke delete on public.off_contribute_requests from authenticated;
