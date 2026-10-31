-- NotebookTools plans (applied to Supabase project vgqfjwwnezwhzwfhpmkz on 2026-10-31).
-- Every account starts on "free"; a Dodo payment for NotebookTools Pro switches it to "pro"
-- (see supabase/functions/dodo-webhook).

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  plan text not null default 'free' check (plan in ('free', 'pro')),
  pro_since timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index profiles_email_lower_idx on public.profiles (lower(email));

create table public.purchases (
  id bigint generated always as identity primary key,
  payment_id text not null unique,
  email text not null,
  user_id uuid references auth.users (id) on delete set null,
  product_id text,
  amount integer,
  currency text,
  status text not null default 'succeeded' check (status in ('succeeded', 'refunded')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index purchases_email_lower_idx on public.purchases (lower(email));
create index purchases_user_id_idx on public.purchases (user_id);

alter table public.profiles enable row level security;
alter table public.purchases enable row level security;

create policy "Read own profile" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);

create policy "Read own purchases" on public.purchases
  for select to authenticated using ((select auth.uid()) = user_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  paid boolean;
begin
  update public.purchases
     set user_id = new.id, updated_at = now()
   where lower(email) = lower(new.email) and user_id is null;

  select exists (
    select 1 from public.purchases
     where user_id = new.id and status = 'succeeded'
  ) into paid;

  insert into public.profiles (id, email, plan, pro_since)
  values (new.id, new.email, case when paid then 'pro' else 'free' end, case when paid then now() else null end)
  on conflict (id) do nothing;

  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.refresh_plan(target uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  paid boolean;
  result text;
begin
  select exists (
    select 1 from public.purchases where user_id = target and status = 'succeeded'
  ) into paid;

  update public.profiles
     set plan = case when paid then 'pro' else 'free' end,
         pro_since = case when paid then coalesce(pro_since, now()) else null end,
         updated_at = now()
   where id = target
  returning plan into result;

  return result;
end;
$$;

revoke execute on function public.refresh_plan(uuid) from public, anon, authenticated;
