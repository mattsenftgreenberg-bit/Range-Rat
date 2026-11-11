-- Level 2: the shared world. Every table is readable by signed-in players where that is safe,
-- and nothing is writable from the browser: all changes go through the `game` and `clock` server functions.

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

-- managers: one per account
create table public.managers (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  cash bigint not null default 25000,
  cosmetics jsonb not null default '{}',
  news jsonb not null default '[]',
  prospect jsonb,
  rerolls int not null default 3,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

-- golfers: yours, your friends', rival stables' and the fixed AI tour members
create table public.golfers (
  id uuid primary key default gen_random_uuid(),
  manager_id uuid references public.managers(id) on delete set null,
  stable text,
  name text not null,
  country text not null,
  college text,
  color int not null default 0,
  arch text,
  tour text not null,
  pool_season int,                       -- fixed AI college rosters belong to one season
  career boolean not null default false, -- ages, moves tours and retires (yours, friends', sold or rival-signed)
  yr int not null default 1,
  sk jsonb not null,
  eq jsonb not null default '{"s":0,"m":0,"l":0}',
  fatigue real not null default 10,
  conf real not null default 0,
  carry real not null default 0,
  sessions int not null default 1,
  trained jsonb not null default '{}',
  coach_id uuid,
  enter_rule text not null default 'all',
  orders jsonb,
  stats jsonb not null default '{}',
  seasons jsonb not null default '[]',
  hist jsonb not null default '[]',
  trophies jsonb not null default '[]',
  best real not null default 0,
  s_pts real not null default 0,
  retired boolean not null default false,
  ret_age int,
  cr jsonb,
  ask bigint,
  listed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index golfers_manager on public.golfers(manager_id);
create index golfers_tour on public.golfers(tour) where not retired;
create index golfers_ask on public.golfers(ask) where ask is not null;

-- what nobody may see: skill ceilings, best time of day, boldness, raw coaching talent
create table public.golfer_secrets (
  golfer_id uuid primary key references public.golfers(id) on delete cascade,
  ce jsonb not null,
  peak int not null,
  agg real not null,
  co jsonb not null
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  tour text not null,
  season int not null,
  week int not null,
  name text not null,
  ci int not null,
  type text not null,
  purse bigint not null,
  fee bigint not null,
  pm real not null,
  starts_at timestamptz not null,
  status text not null default 'open' check (status in ('open','locked','final')),
  rounds_done int not null default 0,
  cut_line int,
  field int not null default 0,
  test boolean not null default false,
  meta jsonb not null default '{}'
);
create index events_start on public.events(starts_at);
create index events_tour on public.events(tour, season);

-- entries: 'in' = entered, 'out' = deliberately skipped (overrides his standing entry rule)
create table public.entries (
  event_id uuid references public.events(id) on delete cascade,
  golfer_id uuid references public.golfers(id) on delete cascade,
  manager_id uuid references public.managers(id) on delete cascade,
  status text not null default 'in' check (status in ('in','out')),
  fee bigint not null default 0,
  created_at timestamptz not null default now(),
  primary key (event_id, golfer_id)
);

-- the field and its results; hidden from the browser, revealed hole by hole by event_board()
create table public.event_players (
  event_id uuid references public.events(id) on delete cascade,
  golfer_id uuid references public.golfers(id) on delete cascade,
  managed boolean not null default false,
  slot0 int not null default 1,
  slot int,
  week_form real not null default 0,
  mood real not null default 0,
  scores jsonb not null default '[]',
  ev_par int not null default 0,
  cut boolean not null default false,
  pos text, pos_n int, pts real not null default 0, pay bigint not null default 0, won boolean not null default false,
  primary key (event_id, golfer_id)
);

create table public.event_shots (
  event_id uuid references public.events(id) on delete cascade,
  golfer_id uuid references public.golfers(id) on delete cascade,
  round int not null, hole int not null,
  shots jsonb not null, mood real, run real,
  primary key (event_id, golfer_id, round, hole)
);

create table public.standings (
  tour text not null, season int not null,
  golfer_id uuid references public.golfers(id) on delete cascade,
  pts real not null default 0, wins int not null default 0, earn bigint not null default 0,
  primary key (tour, season, golfer_id)
);

create table public.ledger (
  id bigserial primary key,
  manager_id uuid references public.managers(id) on delete cascade,
  amount bigint not null, kind text not null, note text,
  at timestamptz not null default now()
);
create index ledger_manager on public.ledger(manager_id, at desc);

create table public.settings (key text primary key, value jsonb not null, updated_at timestamptz not null default now());
create table public.settings_log (id bigserial primary key, key text not null, old jsonb, new jsonb, by uuid, at timestamptz not null default now());

create table public.world (
  id int primary key default 1 check (id = 1),
  season int not null,
  season_start date not null,
  season_end date not null,
  last_daily date,
  meta jsonb not null default '{}'
);

-- read access for signed-in players
alter table public.managers enable row level security;
alter table public.golfers enable row level security;
alter table public.golfer_secrets enable row level security;
alter table public.events enable row level security;
alter table public.entries enable row level security;
alter table public.event_players enable row level security;
alter table public.event_shots enable row level security;
alter table public.standings enable row level security;
alter table public.ledger enable row level security;
alter table public.settings enable row level security;
alter table public.settings_log enable row level security;
alter table public.world enable row level security;

create policy "Managers read their own row" on public.managers for select to authenticated using ((select auth.uid()) = id);
create policy "Everyone reads golfers" on public.golfers for select to authenticated using (true);
create policy "Everyone reads events" on public.events for select to authenticated using (true);
create policy "Everyone reads entries" on public.entries for select to authenticated using (true);
create policy "Everyone reads standings" on public.standings for select to authenticated using (true);
create policy "Managers read their own ledger" on public.ledger for select to authenticated using ((select auth.uid()) = manager_id);
create policy "Everyone reads settings" on public.settings for select to authenticated using (true);
create policy "Everyone reads the world clock" on public.world for select to authenticated using (true);
-- golfer_secrets, event_players, event_shots, settings_log: no browser access at all

revoke all on public.managers, public.golfers, public.golfer_secrets, public.events, public.entries, public.event_players,
  public.event_shots, public.standings, public.ledger, public.settings, public.settings_log, public.world from anon;
revoke insert, update, delete on public.managers, public.golfers, public.events, public.entries, public.standings,
  public.ledger, public.settings, public.world from authenticated;
revoke all on public.golfer_secrets, public.event_players, public.event_shots, public.settings_log from authenticated;
grant select on public.managers, public.golfers, public.events, public.entries, public.standings, public.ledger,
  public.settings, public.world to authenticated;

-- How many holes of each round anyone may see right now.
create or replace function public.visible_holes(e public.events) returns int[]
language sql stable set search_path = '' as $$
  select array_agg(case when e.status = 'final' then 18 else
    least(18, greatest(0, floor(extract(epoch from (now() - (e.starts_at + make_interval(mins => r * coalesce((select (value #>> '{}')::int from public.settings where key = 'round_min'), 15)))))
      / (coalesce((select (value #>> '{}')::int from public.settings where key = 'round_min'), 15) * 60.0 / 18))::int)) end order by r)
  from generate_series(0, 3) r;
$$;

-- The leaderboard as anyone may see it right now: scores only up to the hole that has been played on the clock.
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
        from jsonb_array_elements(p.scores) with ordinality rr(rs, ri)),
      'cut', case when fin or vis[2] = 18 then p.cut else false end,
      'pos', case when fin then p.pos end, 'pos_n', case when fin then p.pos_n end,
      'pts', case when fin then p.pts end, 'pay', case when fin then p.pay end, 'won', case when fin then p.won end))
    into res
  from public.event_players p join public.golfers g on g.id = p.golfer_id
  where p.event_id = eid;
  return jsonb_build_object('event', to_jsonb(e) - 'meta', 'wind', e.meta -> 'wind', 'vis', to_jsonb(vis), 'now', now(), 'players', coalesce(res, '[]'::jsonb));
end $$;

-- Shot-by-shot for one golfer, only for holes already played on the clock (stored for managed golfers).
create or replace function public.event_watch(eid uuid, gid uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare e public.events; vis int[]; res jsonb;
begin
  select * into e from public.events where id = eid;
  if not found then return '[]'::jsonb; end if;
  vis := public.visible_holes(e);
  select coalesce(jsonb_agg(jsonb_build_object('round', s.round, 'hole', s.hole, 'shots', s.shots, 'mood', s.mood, 'run', s.run) order by s.round, s.hole), '[]'::jsonb)
    into res from public.event_shots s
  where s.event_id = eid and s.golfer_id = gid and s.hole < vis[s.round + 1];
  return res;
end $$;

revoke execute on function public.event_board(uuid), public.event_watch(uuid, uuid) from public, anon;
grant execute on function public.event_board(uuid), public.event_watch(uuid, uuid) to authenticated;
revoke execute on function public.visible_holes(public.events) from public, anon, authenticated;

-- Server-only money movement: one atomic change plus a ledger line.
create or replace function public.adjust_cash(mid uuid, amt bigint, kind text, note text default null, allow_negative boolean default true)
returns bigint language plpgsql security definer set search_path = '' as $$
declare c bigint;
begin
  update public.managers set cash = cash + amt where id = mid and (allow_negative or cash + amt >= 0) returning cash into c;
  if c is null then raise exception 'insufficient_funds'; end if;
  insert into public.ledger(manager_id, amount, kind, note) values (mid, amt, kind, note);
  return c;
end $$;

-- Server-only transfer of a listed golfer to a real buyer, all or nothing.
create or replace function public.transfer_golfer(gid uuid, buyer uuid, price bigint) returns boolean
language plpgsql security definer set search_path = '' as $$
declare g public.golfers; bname text;
begin
  select * into g from public.golfers where id = gid for update;
  if g.ask is null or g.ask <> price or g.manager_id = buyer or g.retired then return false; end if;
  select name into bname from public.managers where id = buyer;
  perform public.adjust_cash(buyer, -price, 'transfer', 'Signed ' || g.name, false);
  if g.manager_id is not null then perform public.adjust_cash(g.manager_id, price, 'transfer', 'Sold ' || g.name); end if;
  update public.golfers set manager_id = buyer, stable = bname, ask = null, listed_at = null, coach_id = null, enter_rule = 'all', orders = null, career = true, updated_at = now() where id = gid;
  return true;
end $$;

create or replace function public.add_standing(t text, s int, gid uuid, p real, w int, e bigint) returns void
language sql security definer set search_path = '' as $$
  insert into public.standings(tour, season, golfer_id, pts, wins, earn) values (t, s, gid, p, w, e)
  on conflict (tour, season, golfer_id) do update set pts = public.standings.pts + excluded.pts, wins = public.standings.wins + excluded.wins, earn = public.standings.earn + excluded.earn;
$$;

revoke execute on function public.adjust_cash(uuid, bigint, text, text, boolean), public.transfer_golfer(uuid, uuid, bigint),
  public.add_standing(text, int, uuid, real, int, bigint) from public, anon, authenticated;

-- The clock's shared secret lives in the vault; only the server functions can read it.
select vault.create_secret(encode(extensions.gen_random_bytes(24), 'hex'), 'clock_secret', 'Signs the once-every-20-seconds clock call');
create or replace function public.clock_secret() returns text
language sql security definer set search_path = '' as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'clock_secret' limit 1;
$$;
revoke execute on function public.clock_secret() from public, anon, authenticated;

create or replace function public.touch_golfer() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end; $$;
create trigger golfers_touch before update on public.golfers for each row execute function public.touch_golfer();
