-- Phase 2 Physical Self: goals belong to a life area so Food/Gym can sit with becoming work.

alter table public.goals
  add column if not exists life_area text;

alter table public.goals drop constraint if exists goals_life_area_check;
alter table public.goals add constraint goals_life_area_check
  check (
    life_area is null
    or life_area in (
      'physical', 'mind', 'emotions', 'faith', 'work', 'relationships', 'money', 'purpose'
    )
  );
