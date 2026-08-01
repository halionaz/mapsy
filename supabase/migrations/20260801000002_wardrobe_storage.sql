-- Garment photo storage (PRD §7)
--
-- One private bucket. Object paths are {user_id}/{item_id}/{image_id}.webp, and
-- every policy below keys off that first path segment — which is why the layout
-- is a rule and not a convention.

insert into storage.buckets (id, name, public)
values ('wardrobe', 'wardrobe', false)
on conflict (id) do nothing;

-- Policies have no CREATE ... IF NOT EXISTS, so they are dropped first, keeping
-- this file re-runnable like the bucket insert above.
drop policy if exists "wardrobe: owner reads"   on storage.objects;
drop policy if exists "wardrobe: owner uploads" on storage.objects;
drop policy if exists "wardrobe: owner updates" on storage.objects;
drop policy if exists "wardrobe: owner deletes" on storage.objects;

-- Separate policies per command rather than `for all`, because the read path is
-- the one that will later need to widen (shared wardrobes, public lookbooks)
-- and it should be possible to loosen it without touching writes.

create policy "wardrobe: owner reads"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'wardrobe'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "wardrobe: owner uploads"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'wardrobe'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- `using` guards which rows may be updated, `with check` guards what they may
-- become — without the second, a row could be renamed into another user's
-- folder.
create policy "wardrobe: owner updates"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'wardrobe'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'wardrobe'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "wardrobe: owner deletes"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'wardrobe'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
