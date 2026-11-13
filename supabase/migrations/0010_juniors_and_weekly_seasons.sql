-- Juniors, one Collegiate Tour and one-week seasons.
-- Golfers now start at 15 with three Junior Tour seasons, so every career year moves up by 3
-- (ages and stages stay exactly as they were). The three college circuits become one Collegiate Tour (col0).
-- Season 1 ends with its Finale on Sunday 15 November; from Monday 16 November each season is one week.
alter table public.golfers add column offers jsonb;

update public.golfers set yr = yr + 3;
update public.golfers set tour = 'col0' where tour in ('col1', 'col2');

update public.world set season_end = '2026-11-15', meta = coalesce(meta, '{}'::jsonb) - 'sched' - 'sched_at';

-- clear the old month-long calendar (the clock re-fills it): the old college circuits, and everything from the 14th on
delete from public.events e
 where e.status = 'open' and not e.test and e.tour not like 'qf%'
   and (e.tour in ('col1', 'col2') or (e.starts_at at time zone 'America/New_York')::date >= date '2026-11-14')
   and not exists (select 1 from public.entries x where x.event_id = e.id);
