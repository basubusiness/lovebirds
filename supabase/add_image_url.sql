-- ============================================================
-- HIRT — Add image_url to master_items + Storage bucket
-- Run in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- 1. Add image_url column to master_items
alter table public.master_items
  add column if not exists image_url text default null;

-- 2. Create Supabase Storage bucket for user-uploaded product photos
-- Do this in: Supabase Dashboard → Storage → New bucket
-- Name: product-images
-- Public: YES (so URLs work without auth)
-- Then run the policy below:

-- Allow authenticated users to upload to their own folder
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

create policy "Authenticated users can upload product images"
  on storage.objects for insert
  with check (
    bucket_id = 'product-images' AND
    auth.role() = 'authenticated'
  );

create policy "Anyone can read product images"
  on storage.objects for select
  using (bucket_id = 'product-images');

create policy "Users can update own product images"
  on storage.objects for update
  using (
    bucket_id = 'product-images' AND
    auth.role() = 'authenticated'
  );
