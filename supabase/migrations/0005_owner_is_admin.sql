-- Matthew's account is the admin as soon as his stable is set up.
create or replace function public.owner_admin() returns trigger language plpgsql set search_path = '' as $$
begin if new.id = '29b3225d-75d1-425f-8f7d-c044dff10888' then new.is_admin = true; end if; return new; end; $$;
create trigger managers_owner_admin before insert on public.managers for each row execute function public.owner_admin();
update public.managers set is_admin = true where id = '29b3225d-75d1-425f-8f7d-c044dff10888';
