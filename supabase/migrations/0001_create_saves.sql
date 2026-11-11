-- Applied to the Range Rat Supabase project on 2026-11-11.
-- One saved career per player. Row-level security keeps each player to their own row.
create table public.saves (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null,
  saved_at bigint not null default 0,
  updated_at timestamptz not null default now(),
  constraint saves_size check (pg_column_size(data) < 2000000)
);

alter table public.saves enable row level security;

create policy "Players read their own save" on public.saves
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Players create their own save" on public.saves
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Players update their own save" on public.saves
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Players delete their own save" on public.saves
  for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on public.saves from anon;
grant select, insert, update, delete on public.saves to authenticated;

create or replace function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end; $$;

create trigger saves_touch before update on public.saves
  for each row execute function public.touch_updated_at();
