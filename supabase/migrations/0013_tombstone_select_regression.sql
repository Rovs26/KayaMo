-- Restores the tombstone-visible SELECT rule from 0002 across every table
-- added since, and fixes the touch trigger on tables that have no created_at.
--
-- Migration 0002 established the rule and explained why:
--   1. UPDATE ... RETURNING can tombstone a live row
--   2. The sync cursor can propagate deletes
-- Tables added in 0007, 0008, 0010, 0011, and 0012 reintroduced
-- `deleted_at is null` into their SELECT policies, and 0010 overwrote the fix
-- 0002 had already applied to workout_sets. The effect was that an owner could
-- not read their own tombstone, so a delete made on one device could never
-- reach another -- deleted goals, tasks, and habits came back on next sync.
--
-- App query helpers still filter `deleted_at is null`. Other users still never
-- see these rows, because every policy below stays scoped to the owner.

-- Owner-scoped tables: ownership is the whole rule.

drop policy if exists tasks_select on public.tasks;
create policy tasks_select on public.tasks for select to authenticated
  using (user_id = auth.uid());

drop policy if exists routines_select on public.routines;
create policy routines_select on public.routines for select to authenticated
  using (user_id = auth.uid());

drop policy if exists routine_completions_select on public.routine_completions;
create policy routine_completions_select on public.routine_completions for select to authenticated
  using (user_id = auth.uid());

drop policy if exists daily_plans_select on public.daily_plans;
create policy daily_plans_select on public.daily_plans for select to authenticated
  using (user_id = auth.uid());

drop policy if exists focus_sessions_select on public.focus_sessions;
create policy focus_sessions_select on public.focus_sessions for select to authenticated
  using (user_id = auth.uid());

drop policy if exists daily_loop_preferences_select on public.daily_loop_preferences;
create policy daily_loop_preferences_select on public.daily_loop_preferences for select to authenticated
  using (user_id = auth.uid());

drop policy if exists goals_select on public.goals;
create policy goals_select on public.goals for select to authenticated
  using (user_id = auth.uid());

drop policy if exists habits_select on public.habits;
create policy habits_select on public.habits for select to authenticated
  using (user_id = auth.uid());

drop policy if exists meal_templates_select on public.meal_templates;
create policy meal_templates_select on public.meal_templates for select to authenticated
  using (user_id = auth.uid());

drop policy if exists workout_plans_select on public.workout_plans;
create policy workout_plans_select on public.workout_plans for select to authenticated
  using (user_id = auth.uid());

drop policy if exists workout_plan_exercises_select on public.workout_plan_exercises;
create policy workout_plan_exercises_select on public.workout_plan_exercises for select to authenticated
  using (user_id = auth.uid());

drop policy if exists coco_conversations_select on public.coco_conversations;
create policy coco_conversations_select on public.coco_conversations for select to authenticated
  using (user_id = auth.uid());

-- `explicit` is a visibility rule, not a tombstone rule: memories the user
-- never asked Coco to keep stay unreadable by the client either way.
drop policy if exists agent_memory_select on public.agent_memory;
create policy agent_memory_select on public.agent_memory for select to authenticated
  using (user_id = auth.uid() and explicit = true);

-- Child tables: the parent check narrows to ownership only. A tombstoned
-- parent cascades its own tombstone onto children via
-- kayamo_cascade_journey_tombstone and kayamo_tombstone_workout_sets, so the
-- child carries a tombstone of its own and does not need the parent's
-- deleted_at repeated here -- which is what hid it from the sync cursor.

drop policy if exists goal_milestones_select on public.goal_milestones;
create policy goal_milestones_select on public.goal_milestones for select to authenticated
  using (
    user_id = auth.uid()
    and exists (
      select 1 from public.goals g
      where g.id = goal_milestones.goal_id
        and g.user_id = auth.uid()
    )
  );

drop policy if exists habit_completions_select on public.habit_completions;
create policy habit_completions_select on public.habit_completions for select to authenticated
  using (
    user_id = auth.uid()
    and exists (
      select 1 from public.habits h
      where h.id = habit_completions.habit_id
        and h.user_id = auth.uid()
    )
  );

drop policy if exists coco_messages_select on public.coco_messages;
create policy coco_messages_select on public.coco_messages for select to authenticated
  using (
    user_id = auth.uid()
    and exists (
      select 1 from public.coco_conversations c
      where c.id = coco_messages.conversation_id
        and c.user_id = auth.uid()
    )
  );

drop policy if exists workout_sets_select on public.workout_sets;
create policy workout_sets_select on public.workout_sets for select to authenticated
  using (
    user_id = auth.uid()
    and exists (
      select 1 from public.workouts w
      where w.id = workout_sets.workout_id
        and w.user_id = auth.uid()
    )
  );

-- Shared catalog table: mirrors the foods rule from 0002. The creator sees
-- their own rows including tombstones; everyone else sees only live entries
-- that are shared or not user-authored.
drop policy if exists exercises_select on public.exercises;
create policy exercises_select on public.exercises for select to authenticated
  using (
    created_by = auth.uid()
    or (
      deleted_at is null
      and (source <> 'user' or shared = true)
    )
  );

-- kayamo_touch_row assigns new.created_at unconditionally, which raises
-- `record "new" has no field "created_at"` on tables that do not carry one.
-- companion_state is a per-user singleton and the three definition tables are
-- catalogs, so none of them want a created_at column -- they want a narrower
-- trigger. Without this, every write to these tables failed, which meant
-- companion points could never be awarded.
create or replace function public.kayamo_touch_state_row()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.server_updated_at := now();
  if new.updated_at is null then
    new.updated_at := now();
  elsif new.updated_at > now() + interval '5 minutes' then
    new.updated_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists companion_state_touch on public.companion_state;
create trigger companion_state_touch
  before insert or update on public.companion_state
  for each row execute function public.kayamo_touch_state_row();

drop trigger if exists achievement_definitions_touch on public.achievement_definitions;
create trigger achievement_definitions_touch
  before insert or update on public.achievement_definitions
  for each row execute function public.kayamo_touch_state_row();

drop trigger if exists cosmetic_definitions_touch on public.cosmetic_definitions;
create trigger cosmetic_definitions_touch
  before insert or update on public.cosmetic_definitions
  for each row execute function public.kayamo_touch_state_row();

drop trigger if exists evolution_stages_touch on public.evolution_stages;
create trigger evolution_stages_touch
  before insert or update on public.evolution_stages
  for each row execute function public.kayamo_touch_state_row();
