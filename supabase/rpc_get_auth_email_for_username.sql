-- Run this in Supabase SQL Editor (once per project).
-- Lets users sign in with username + password while auth.users.email is their real address.
--
-- Privacy: anyone who knows a username can learn the linked email. Accept only if that is OK for your app.

create or replace function public.get_auth_email_for_username(p_username text)
returns text
language sql
security definer
set search_path = public
stable
as $$
  select u.email::text
  from auth.users u
  inner join public.profiles p on p.id = u.id
  where lower(p.username) = lower(trim(p_username))
  limit 1;
$$;

grant execute on function public.get_auth_email_for_username(text) to anon, authenticated;
