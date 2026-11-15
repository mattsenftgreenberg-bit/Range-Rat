-- Every manager can see every other manager's roster and record. Bank balances stay private.
create or replace function public.league() returns table (
  id uuid, name text, joined timestamptz, golfers int, coaches int, wins int, qf_wins int, top10 int, events int,
  prizes bigint, other bigint, mine boolean)
language sql stable security definer set search_path = '' as $$
  select m.id, m.name, m.created_at,
    (select count(*) from public.golfers g where g.manager_id = m.id and not g.retired)::int,
    (select count(*) from public.golfers g where g.manager_id = m.id and g.retired)::int,
    (select coalesce(sum((g.stats->>'wins')::int), 0) from public.golfers g where g.manager_id = m.id)::int,
    (select coalesce(sum((g.stats->>'qf_wins')::int), 0) from public.golfers g where g.manager_id = m.id)::int,
    (select coalesce(sum((g.stats->>'top10')::int), 0) from public.golfers g where g.manager_id = m.id)::int,
    (select coalesce(sum((g.stats->>'ev')::int), 0) from public.golfers g where g.manager_id = m.id)::int,
    (select coalesce(sum(l.amount), 0) from public.ledger l where l.manager_id = m.id and l.kind in ('prize', 'bonus'))::bigint,
    (select coalesce(sum(l.amount), 0) from public.ledger l where l.manager_id = m.id and l.kind in ('nil', 'coaching', 'transfer') and l.amount > 0)::bigint,
    m.id = (select auth.uid())
  from public.managers m
  order by 10 desc;
$$;
revoke execute on function public.league() from public, anon;
grant execute on function public.league() to authenticated;
