-- Food search recall for the resolver cascade (Chapter 8).
-- security invoker: RLS still hides other users' private foods.
-- extensions.similarity is pg_trgm (installed in schema extensions).

create or replace function public.kayamo_search_foods(p_query text, p_limit integer default 25)
returns table (food_id uuid, similarity real)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  with q as (
    select lower(btrim(coalesce(p_query, ''))) as q
  )
  select f.id as food_id, s.sim as similarity
  from public.foods f
  cross join q
  cross join lateral (
    select greatest(
      extensions.similarity(lower(f.name), q.q),
      coalesce((
        select max(extensions.similarity(lower(alias), q.q))
        from unnest(f.name_tl) as alias
      ), 0),
      coalesce((
        select max(extensions.similarity(lower(a.alias), q.q))
        from public.food_aliases a
        where a.food_id = f.id
      ), 0)
    ) as sim
  ) s
  where q.q <> ''
    and f.deleted_at is null
    and s.sim >= 0.2
  order by s.sim desc, f.name asc
  limit least(greatest(coalesce(p_limit, 25), 1), 50);
$$;

create or replace function public.kayamo_food_log_counts(p_food_ids uuid[])
returns table (food_id uuid, times_logged integer)
language sql
stable
security invoker
set search_path = public
as $$
  select fe.food_id, count(*)::integer as times_logged
  from public.food_entries fe
  where fe.user_id = auth.uid()
    and fe.deleted_at is null
    and fe.food_id = any(coalesce(p_food_ids, '{}'::uuid[]))
  group by fe.food_id;
$$;

revoke all on function public.kayamo_search_foods(text, integer) from public, anon;
revoke all on function public.kayamo_food_log_counts(uuid[]) from public, anon;
grant execute on function public.kayamo_search_foods(text, integer) to authenticated, service_role;
grant execute on function public.kayamo_food_log_counts(uuid[]) to authenticated, service_role;
