
-- BACKFILL: Update existing "porteiro" entries with actual names if available
update public.banner_acknowledgments ba
set full_name = p.full_name
from public.profiles p
where ba.user_id = p.id
  and (ba.full_name is null or lower(ba.full_name) = 'porteiro')
  and p.full_name is not null
  and lower(p.full_name) != 'porteiro';

-- TRIGGER: Ensure new entries don't save generic "porteiro" if the profile has a name
create or replace function public.handle_banner_ack_full_name()
returns trigger
language plpgsql
security definer
as $$
declare
    actual_name text;
begin
    -- Only try to fetch if the incoming name is empty or generic
    if new.full_name is null or lower(new.full_name) = 'porteiro' then
        select full_name into actual_name
        from public.profiles
        where id = new.user_id;

        if actual_name is not null and lower(actual_name) != 'porteiro' then
            new.full_name := actual_name;
        end if;
    end if;

    -- If it's still null, default to "Porteiro" for display consistency
    if new.full_name is null then
        new.full_name := 'Porteiro';
    end if;

    return new;
end;
$$;

-- Ensure the trigger exists
drop trigger if exists on_banner_ack_insert on public.banner_acknowledgments;
create trigger on_banner_ack_insert
    before insert on public.banner_acknowledgments
    for each row execute function public.handle_banner_ack_full_name();

-- DROP AND RECREATE RPC: Required when changing return types/columns
DROP FUNCTION IF EXISTS public.get_banner_acknowledgments(uuid);

create or replace function public.get_banner_acknowledgments(_banner_id uuid)
returns table (
    user_id uuid,
    full_name text,
    email text
)
language sql
security definer
set search_path = public
as $$
  select 
    ba.user_id,
    case 
      when ba.full_name is not null and lower(ba.full_name) != 'porteiro' then ba.full_name
      when p.full_name is not null and lower(p.full_name) != 'porteiro' then p.full_name
      else 'Porteiro'
    end as full_name,
    p.email
  from public.banner_acknowledgments ba
  left join public.profiles p on p.id = ba.user_id
  where ba.banner_id = _banner_id;
$$;

