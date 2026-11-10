-- Make sure every account has a profile, and give the Dodo webhook a reliable
-- way to find (or create) the profile for a buyer.

-- 1. Backfill: accounts created without a profile row. Claim any purchases made
--    with the same email, then set the plan from them.
update public.purchases p
   set user_id = u.id, updated_at = now()
  from auth.users u
 where p.user_id is null and lower(p.email) = lower(u.email);

insert into public.profiles (id, email, plan, pro_since)
select u.id,
       coalesce(u.email, ''),
       case when exists (select 1 from public.purchases p where p.user_id = u.id and p.status = 'succeeded') then 'pro' else 'free' end,
       case when exists (select 1 from public.purchases p where p.user_id = u.id and p.status = 'succeeded') then now() end
  from auth.users u
 where not exists (select 1 from public.profiles pr where pr.id = u.id);

-- 2. Lookup used by the webhook: returns the account id for a user id or email,
--    creating the profile row if it is missing. Null when there is no account.
create or replace function public.profile_id_for(target_id uuid, target_email text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  found_id uuid;
  found_email text;
begin
  if target_id is not null then
    select u.id, u.email into found_id, found_email from auth.users u where u.id = target_id;
  end if;

  if found_id is null and coalesce(target_email, '') <> '' then
    select u.id, u.email into found_id, found_email
      from auth.users u
     where lower(u.email) = lower(target_email)
     order by u.created_at
     limit 1;
  end if;

  if found_id is null then
    return null;
  end if;

  insert into public.profiles (id, email)
  values (found_id, coalesce(found_email, ''))
  on conflict (id) do nothing;

  return found_id;
end;
$$;

revoke execute on function public.profile_id_for(uuid, text) from public, anon, authenticated;
grant execute on function public.profile_id_for(uuid, text) to service_role;

-- 3. Security advisor: rls_auto_enable is an event-trigger helper, not an API.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
