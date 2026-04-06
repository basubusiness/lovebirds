-- ============================================================
-- HIRT — Add master_item_id to products + auto-link migration
-- Run in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- 1. Add master_item_id column to products
alter table public.products
  add column if not exists master_item_id bigint
  references public.master_items(id) on delete set null;

-- 2. Enable pg_trgm for fuzzy name matching
create extension if not exists pg_trgm;

-- 3. Auto-link existing products to master items by name similarity
update public.products p
set master_item_id = best.matched_master_id
from (
  select distinct on (p2.id)
    p2.id                                      as product_id,
    mi.id                                      as matched_master_id,
    similarity(lower(p2.name), lower(mi.name)) as sim
  from public.products p2
  cross join public.master_items mi
  where similarity(lower(p2.name), lower(mi.name)) >= 0.3
  order by p2.id, similarity(lower(p2.name), lower(mi.name)) desc
) best
where p.id = best.product_id
  and p.master_item_id is null;

-- 4. Show what got linked (for verification)
select
  p.name  as product_name,
  mi.name as linked_master_item,
  similarity(lower(p.name), lower(mi.name)) as sim
from public.products p
join public.master_items mi on mi.id = p.master_item_id
order by p.name;
