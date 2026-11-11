-- Only list rounds that have started on the clock, so the number of rounds can't give away a missed cut early.
create or replace function public.event_board(eid uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare e public.events; vis int[]; fin boolean; res jsonb;
begin
  select * into e from public.events where id = eid;
  if not found then return null; end if;
  fin := e.status = 'final';
  vis := public.visible_holes(e);
  select jsonb_agg(jsonb_build_object(
      'id', g.id, 'name', g.name, 'country', g.country, 'college', g.college, 'stable', g.stable,
      'mine', g.manager_id = (select auth.uid()), 'managed', g.manager_id is not null,
      'sk', g.sk, 'eq', g.eq, 'conf', g.conf, 'fatigue', g.fatigue,
      'scores', (select coalesce(jsonb_agg(
          (select coalesce(jsonb_agg(x order by i), '[]'::jsonb) from jsonb_array_elements(rs) with ordinality s(x, i) where i <= vis[ri::int])
          order by ri), '[]'::jsonb)
        from jsonb_array_elements(p.scores) with ordinality rr(rs, ri) where vis[ri::int] > 0),
      'cut', case when fin or vis[2] = 18 then p.cut else false end,
      'pos', case when fin then p.pos end, 'pos_n', case when fin then p.pos_n end,
      'pts', case when fin then p.pts end, 'pay', case when fin then p.pay end, 'won', case when fin then p.won end))
    into res
  from public.event_players p join public.golfers g on g.id = p.golfer_id
  where p.event_id = eid;
  return jsonb_build_object('event', to_jsonb(e) - 'meta' - 'cut_line' || jsonb_build_object('cut_line', case when fin or vis[2] = 18 then e.cut_line end), 'wind', (select jsonb_agg(w order by i) from jsonb_array_elements(coalesce(e.meta -> 'wind', '[]')) with ordinality x(w, i) where vis[i::int] > 0), 'vis', to_jsonb(vis), 'now', now(), 'players', coalesce(res, '[]'::jsonb));
end $$;

-- The browser may read events, but not the cut line or the wind before they happen on the clock.
revoke select on public.events from authenticated;
grant select (id, tour, season, week, name, ci, type, purse, fee, pm, starts_at, status, rounds_done, field, test) on public.events to authenticated;
