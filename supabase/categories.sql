-- ============================================================
-- Run this in Supabase SQL Editor → New query
-- This adds the categories table to your existing schema.
-- Your existing products table is unchanged.
-- ============================================================

-- ── Categories table ─────────────────────────────────────────
create table if not exists public.categories (
  id          serial      primary key,
  name        text        not null,
  parent_id   int         references public.categories(id) on delete set null,
  icon        text        not null default '',
  sort_order  int         not null default 0
);

-- Categories are shared / global (not per-user), so no RLS needed.
-- Anyone authenticated can read them.
alter table public.categories enable row level security;

create policy "Authenticated users read categories"
  on public.categories for select
  to authenticated
  using (true);

-- ── Seed data ─────────────────────────────────────────────────
-- Top-level categories
insert into public.categories (id, name, parent_id, icon, sort_order) values
  (1,  'Grocery',        null, '🛒', 1),
  (2,  'Personal Care',  null, '🧴', 2),
  (3,  'Cleaning',       null, '🧹', 3),
  (4,  'Baby & Kids',    null, '👶', 4),
  (5,  'Household',      null, '🏠', 5),
  (6,  'Other',          null, '📦', 6)
on conflict (id) do nothing;

-- Sub-categories under Grocery (parent_id = 1)
insert into public.categories (id, name, parent_id, icon, sort_order) values
  (10, 'Fresh Produce',  1, '🥦', 1),
  (11, 'Dairy & Eggs',   1, '🥛', 2),
  (12, 'Meat & Fish',    1, '🥩', 3),
  (13, 'Bakery',         1, '🍞', 4),
  (14, 'Pantry',         1, '🫙', 5),
  (15, 'Frozen',         1, '🧊', 6),
  (16, 'Beverages',      1, '🥤', 7),
  (17, 'Snacks',         1, '🍪', 8),
  (18, 'Condiments',     1, '🫙', 9)
on conflict (id) do nothing;

-- Sub-categories under Personal Care (parent_id = 2)
insert into public.categories (id, name, parent_id, icon, sort_order) values
  (20, 'Skincare',       2, '✨', 1),
  (21, 'Hair',           2, '💆', 2),
  (22, 'Dental',         2, '🪥', 3),
  (23, 'Hygiene',        2, '🧼', 4)
on conflict (id) do nothing;

-- Sub-categories under Cleaning (parent_id = 3)
insert into public.categories (id, name, parent_id, icon, sort_order) values
  (30, 'Laundry',        3, '👕', 1),
  (31, 'Dishwashing',    3, '🍽️', 2),
  (32, 'Surface',        3, '🫧', 3),
  (33, 'Bathroom',       3, '🚿', 4)
on conflict (id) do nothing;

-- Sub-categories under Baby & Kids (parent_id = 4)
insert into public.categories (id, name, parent_id, icon, sort_order) values
  (40, 'Diapers & Wipes', 4, '🧷', 1),
  (41, 'Baby Food',       4, '🍼', 2),
  (42, 'Toys & Books',    4, '🧸', 3)
on conflict (id) do nothing;

-- Sub-categories under Household (parent_id = 5)
insert into public.categories (id, name, parent_id, icon, sort_order) values
  (50, 'Paper & Wrap',   5, '🧻', 1),
  (51, 'Batteries',      5, '🔋', 2),
  (52, 'Light Bulbs',    5, '💡', 3)
on conflict (id) do nothing;

-- ── Add category_id to products ───────────────────────────────
-- Adds a foreign key to products so each product links to a category.
-- Existing products will have null (they'll show under 'Other').
alter table public.products
  add column if not exists category_id int references public.categories(id) on delete set null;
