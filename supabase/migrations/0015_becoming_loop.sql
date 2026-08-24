-- Phase 1 becoming loop: day-plan metadata, weekly reset cursor, compass areas.

alter table public.daily_plans
  add column if not exists capacity text,
  add column if not exists day_intent text,
  add column if not exists plan_mode text,
  add column if not exists tomorrow_note text;

alter table public.daily_plans drop constraint if exists daily_plans_capacity_check;
alter table public.daily_plans add constraint daily_plans_capacity_check
  check (capacity is null or capacity in ('great', 'normal', 'low', 'overwhelmed', 'sick'));

alter table public.daily_plans drop constraint if exists daily_plans_intent_check;
alter table public.daily_plans add constraint daily_plans_intent_check
  check (
    day_intent is null
    or day_intent in ('focused', 'calm', 'recovery', 'family', 'get_things_done')
  );

alter table public.daily_plans drop constraint if exists daily_plans_mode_check;
alter table public.daily_plans add constraint daily_plans_mode_check
  check (plan_mode is null or plan_mode in ('standard', 'minimum', 'rescue', 'restructure'));

alter table public.daily_plans drop constraint if exists daily_plans_tomorrow_note_len;
alter table public.daily_plans add constraint daily_plans_tomorrow_note_len
  check (tomorrow_note is null or char_length(trim(tomorrow_note)) between 1 and 500);

alter table public.daily_loop_preferences
  add column if not exists last_weekly_reset_on date;

alter table public.compasses
  add column if not exists active_areas text[] not null default '{}';

alter table public.compasses drop constraint if exists compasses_active_areas_check;
alter table public.compasses add constraint compasses_active_areas_check
  check (
    active_areas <@ array[
      'physical', 'mind', 'emotions', 'faith', 'work', 'relationships', 'money', 'purpose'
    ]::text[]
  );
