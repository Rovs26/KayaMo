-- Bundle 3 nutrition guidance. Estimates and targets are code-derived,
-- versioned records; no model is allowed to produce these values.

alter table public.expenditure_estimates
  add column source text not null default 'expenditure_engine',
  add column confidence numeric(3, 2) not null default 0.25,
  add constraint expenditure_estimates_source_check
    check (source = 'expenditure_engine'),
  add constraint expenditure_estimates_confidence_check
    check (confidence between 0 and 1),
  add constraint expenditure_estimates_values_check check (
    tdee_kcal > 0
    and (ci_low is null or ci_low > 0)
    and (ci_high is null or ci_high > 0)
  );

alter table public.targets
  add column weekly_rate_percent numeric(12, 4) not null default 0,
  add column clamp_reasons text[] not null default '{}'::text[],
  add column source text not null default 'target_engine',
  add column confidence numeric(3, 2) not null default 0.25,
  add constraint targets_source_check check (source = 'target_engine'),
  add constraint targets_confidence_check check (confidence between 0 and 1),
  add constraint targets_nutrients_nonnegative check (
    kcal >= 0 and protein_g >= 0 and carbs_g >= 0 and fat_g >= 0
  ),
  add constraint targets_weekly_rate_check
    check (weekly_rate_percent between 0 and 1);

alter table public.foods
  add constraint foods_nutrients_nonnegative check (
    kcal >= 0 and protein_g >= 0 and carbs_g >= 0 and fat_g >= 0
    and fiber_g >= 0 and sugar_g >= 0 and sodium_mg >= 0
  );

alter table public.food_entries
  add constraint food_entries_nutrients_nonnegative check (
    kcal >= 0 and protein_g >= 0 and carbs_g >= 0 and fat_g >= 0
    and fiber_g >= 0 and sugar_g >= 0 and sodium_mg >= 0
  );

alter table public.profiles
  add constraint profiles_birth_year_check
    check (birth_year is null or birth_year between 1900 and 2100),
  add constraint profiles_height_check
    check (height_cm is null or height_cm > 0),
  add constraint profiles_activity_baseline_check
    check (activity_baseline is null or activity_baseline between 1.2 and 2);

create or replace function public.kayamo_validate_nutrition_target()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_sex text;
  v_floor numeric;
begin
  select p.sex into v_sex
  from public.profiles p
  where p.user_id = new.user_id;

  -- Unknown sex uses the more conservative floor. There is no override path.
  v_floor := case when v_sex = 'female' then 1200 else 1500 end;
  if new.kcal < v_floor then
    raise exception 'nutrition target is below the safety floor'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger targets_validate_safety before insert or update on public.targets
  for each row execute function public.kayamo_validate_nutrition_target();

create or replace function public.kayamo_validate_profile_timezone()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- PostgreSQL raises for unknown IANA timezone names.
  perform pg_catalog.timezone(new.timezone, now());
  return new;
end;
$$;

create trigger profiles_validate_timezone before insert or update of timezone
  on public.profiles
  for each row execute function public.kayamo_validate_profile_timezone();

revoke all on function public.kayamo_validate_nutrition_target() from public, anon;
revoke all on function public.kayamo_validate_profile_timezone() from public, anon;
grant execute on function public.kayamo_validate_nutrition_target() to authenticated, service_role;
grant execute on function public.kayamo_validate_profile_timezone() to authenticated, service_role;
