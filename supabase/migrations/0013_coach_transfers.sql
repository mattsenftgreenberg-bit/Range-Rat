-- Coaches can be bought and sold on the transfer market. A coach is a retired golfer with a coaching record (cr).
-- Moves him to the buyer's roster and settles the money in one step, like transfer_golfer for players.
create or replace function public.transfer_coach(gid uuid, buyer uuid, price bigint) returns boolean
language plpgsql security definer set search_path = '' as $$
declare g public.golfers; bname text;
begin
  select * into g from public.golfers where id = gid for update;
  if g.ask is null or g.ask <> price or g.manager_id = buyer or not g.retired or g.cr is null then return false; end if;
  select name into bname from public.managers where id = buyer;
  perform public.adjust_cash(buyer, -price, 'transfer', 'Hired coach ' || g.name, false);
  if g.manager_id is not null then perform public.adjust_cash(g.manager_id, price, 'transfer', 'Sold coach ' || g.name); end if;
  update public.golfers set manager_id = buyer, stable = bname, ask = null, listed_at = null where id = gid;
  return true;
end $$;
revoke execute on function public.transfer_coach(uuid, uuid, bigint) from public, anon, authenticated;
