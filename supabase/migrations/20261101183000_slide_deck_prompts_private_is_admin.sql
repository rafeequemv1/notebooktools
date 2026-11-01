-- Keep the admin check out of the public API (/rest/v1/rpc): every policy
-- calls private.is_admin(); public.is_admin() is dropped.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select p.is_admin from public.profiles p where p.id = auth.uid()), false);
$$;

revoke all on function private.is_admin() from public;
grant execute on function private.is_admin() to anon, authenticated;

drop policy if exists "Published prompts are public" on public.slide_deck_prompts;
create policy "Published prompts are public" on public.slide_deck_prompts
  for select to anon, authenticated
  using (published or (select private.is_admin()));

drop policy if exists "Admins manage prompts" on public.slide_deck_prompts;
create policy "Admins manage prompts" on public.slide_deck_prompts
  for all to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

drop policy if exists "Images of published prompts are public" on public.slide_deck_prompt_images;
create policy "Images of published prompts are public" on public.slide_deck_prompt_images
  for select to anon, authenticated
  using (exists (
    select 1 from public.slide_deck_prompts p
    where p.id = prompt_id and (p.published or (select private.is_admin()))
  ));

drop policy if exists "Admins manage prompt images" on public.slide_deck_prompt_images;
create policy "Admins manage prompt images" on public.slide_deck_prompt_images
  for all to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

drop policy if exists "Admins upload slide deck images" on storage.objects;
create policy "Admins upload slide deck images" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'slide-deck-images' and (select private.is_admin()));

drop policy if exists "Admins update slide deck images" on storage.objects;
create policy "Admins update slide deck images" on storage.objects
  for update to authenticated
  using (bucket_id = 'slide-deck-images' and (select private.is_admin()))
  with check (bucket_id = 'slide-deck-images' and (select private.is_admin()));

drop policy if exists "Admins delete slide deck images" on storage.objects;
create policy "Admins delete slide deck images" on storage.objects
  for delete to authenticated
  using (bucket_id = 'slide-deck-images' and (select private.is_admin()));

drop function if exists public.is_admin();
