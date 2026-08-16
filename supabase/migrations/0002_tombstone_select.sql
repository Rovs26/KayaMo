-- Owners must be able to SELECT their own tombstones so:
-- 1. UPDATE ... RETURNING can tombstone a live row
-- 2. The sync cursor can propagate deletes
-- App query helpers still filter deleted_at IS NULL.
-- Other users never see those rows (own-rows RLS).

drop policy if exists foods_select on public.foods;
create policy foods_select on public.foods for select to authenticated
  using (
    created_by = auth.uid()
    or (
      deleted_at is null
      and (source <> 'user' or shared = true)
    )
  );

drop policy if exists food_entries_select on public.food_entries;
create policy food_entries_select on public.food_entries for select to authenticated
  using (user_id = auth.uid());

drop policy if exists workouts_select on public.workouts;
create policy workouts_select on public.workouts for select to authenticated
  using (user_id = auth.uid());

drop policy if exists workout_sets_select on public.workout_sets;
create policy workout_sets_select on public.workout_sets for select to authenticated
  using (
    exists (
      select 1 from public.workouts w
      where w.id = workout_sets.workout_id
        and w.user_id = auth.uid()
    )
  );

drop policy if exists weight_logs_select on public.weight_logs;
create policy weight_logs_select on public.weight_logs for select to authenticated
  using (user_id = auth.uid());
