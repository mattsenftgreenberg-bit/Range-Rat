-- Faster events: each event keeps its own round length, so changing the setting never disturbs one in progress.
-- Starting odds are worked out once, when the field is set, and shown beside the live odds.
alter table public.events add column round_min numeric not null default 7.5;
update public.events set round_min = 15 where starts_at <= now() or status <> 'open';
grant select (round_min) on public.events to authenticated;
alter table public.event_players add column odds0 real;

insert into public.settings (key, value) values ('round_min', '7.5'::jsonb)
  on conflict (key) do update set value = excluded.value, updated_at = now();
insert into public.settings_log (key, old, new) values ('round_min', '15'::jsonb, '7.5'::jsonb);

create or replace function public.visible_holes(e public.events) returns int[]
language sql stable set search_path = '' as $$
  select array_agg(case when e.status = 'final' then 18 else
    least(18, greatest(0, floor(extract(epoch from (now() - e.starts_at)) / 60.0 / e.round_min * 18 - r * 18)))::int end order by r)
  from generate_series(0, 3) r;
$$;

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
      'sk', g.sk, 'eq', g.eq, 'conf', g.conf, 'fatigue', g.fatigue, 'odds0', p.odds0,
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
