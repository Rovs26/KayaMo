-- Keep identity tombstones visible to their owner for UPDATE ... RETURNING
-- and future cursor-based sync. Product-facing local query helpers continue
-- to hide deleted rows. RLS still prevents every cross-user read.

drop policy if exists future_selves_select on public.future_selves;
create policy future_selves_select on public.future_selves for select to authenticated
  using (user_id = auth.uid());

drop policy if exists compasses_select on public.compasses;
create policy compasses_select on public.compasses for select to authenticated
  using (user_id = auth.uid());

drop policy if exists inbox_items_select on public.inbox_items;
create policy inbox_items_select on public.inbox_items for select to authenticated
  using (user_id = auth.uid());

drop policy if exists personal_rules_select on public.personal_rules;
create policy personal_rules_select on public.personal_rules for select to authenticated
  using (user_id = auth.uid());

-- Supabase's postgres default ACL grants administrative table privileges to
-- API roles. TRUNCATE bypasses RLS, while REFERENCES, TRIGGER, and MAINTAIN
-- are not client operations. Remove them from existing public tables and
-- prevent the same grants from recurring on future migrations. Intended DML
-- privileges remain exactly as granted by each table's migration.
revoke truncate, references, trigger, maintain on all tables in schema public
  from anon, authenticated;

alter default privileges for role postgres in schema public
  revoke truncate, references, trigger, maintain on tables from anon, authenticated;
