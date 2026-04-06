-- Add image_url to products table (user-owned, full RLS access)
-- This is simpler than master_items which has seed rows with user_id = null
alter table public.products
  add column if not exists image_url text default null;
