-- Level 2, part 2: a private place for each manager's scouted prospect (its ceilings stay hidden),
-- and the clock: pg_cron calls the `clock` server function every 20 seconds.

create table public.manager_secrets (
  id uuid primary key references public.managers(id) on delete cascade,
  prospect jsonb
);
alter table public.manager_secrets enable row level security;
revoke all on public.manager_secrets from anon, authenticated;

select cron.schedule('range-rat-clock', '20 seconds', $$
  select net.http_post(
    url := 'https://mqqshohxbwzrgtonresb.supabase.co/functions/v1/clock',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-clock-secret', public.clock_secret()),
    body := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
$$);
