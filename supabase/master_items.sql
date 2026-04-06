-- ============================================================
-- HIRT — master_items table
-- Shared seed items (user_id IS NULL) + private user items
-- Run in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

create table if not exists public.master_items (
  id                      bigint      generated always as identity primary key,
  user_id                 uuid        references auth.users(id) on delete cascade,
  -- null user_id = global seed item visible to all
  name                    text        not null,
  category_id             int         references public.categories(id),
  unit                    text        not null default 'pc',
  default_min_qty         numeric     not null default 1,
  default_burn_qty        numeric     not null default 1,
  default_burn_interval_days int      not null default 7,
  default_vendor          text        not null default '',
  notes                   text        not null default '',
  created_at              timestamptz not null default now()
);

alter table public.master_items enable row level security;

-- Anyone can read seed items (user_id IS NULL) + their own
create policy "Read seed and own master items"
  on public.master_items for select
  using (user_id is null or auth.uid() = user_id);

create policy "Users insert own master items"
  on public.master_items for insert
  with check (auth.uid() = user_id);

create policy "Users update own master items"
  on public.master_items for update
  using (auth.uid() = user_id);

create policy "Users delete own master items"
  on public.master_items for delete
  using (auth.uid() = user_id);

-- ── Seed data (~60 common Luxembourg household items) ────────
-- category_id refs: 10=Fresh Produce, 11=Dairy & Eggs, 12=Meat & Fish,
-- 13=Bakery, 14=Pantry, 15=Frozen, 16=Beverages, 17=Snacks, 18=Condiments
-- 20=Skincare, 21=Hair, 22=Dental, 23=Hygiene
-- 30=Laundry, 31=Dishwashing, 32=Surface, 33=Bathroom
-- 40=Diapers & Wipes, 41=Baby Food, 42=Toys & Books
-- 50=Paper & Wrap, 51=Batteries, 52=Light Bulbs

insert into public.master_items
  (user_id, name, category_id, unit, default_min_qty, default_burn_qty, default_burn_interval_days, default_vendor)
values
  -- Dairy & Eggs
  (null, 'Whole Milk',           11, 'L',    2,   2,   3,  'cactus'),
  (null, 'Semi-skimmed Milk',    11, 'L',    2,   2,   3,  'cactus'),
  (null, 'Oat Milk',             11, 'L',    2,   1,   5,  'cactus'),
  (null, 'Greek Yogurt',         11, 'pc',   3,   2,   4,  'cactus'),
  (null, 'Natural Yogurt',       11, 'pc',   3,   2,   4,  'cactus'),
  (null, 'Butter',               11, 'pc',   1,   1,  14,  'cactus'),
  (null, 'Eggs (12-pack)',        11, 'pc',   1,   1,   7,  'cactus'),
  (null, 'Cheddar Cheese',       11, 'pc',   1,   1,  10,  'cactus'),
  (null, 'Cream Cheese',         11, 'pc',   1,   1,  14,  'cactus'),
  -- Fresh Produce
  (null, 'Bananas',              10, 'pc',   4,   4,   5,  'cactus'),
  (null, 'Apples',               10, 'pc',   4,   4,   7,  'cactus'),
  (null, 'Tomatoes',             10, 'pc',   4,   4,   5,  'cactus'),
  (null, 'Onions',               10, 'pc',   3,   2,   7,  'cactus'),
  (null, 'Garlic',               10, 'pc',   2,   1,  10,  'cactus'),
  (null, 'Lemons',               10, 'pc',   3,   2,   7,  'cactus'),
  (null, 'Carrots',              10, 'pc',   4,   3,   7,  'cactus'),
  (null, 'Spinach',              10, 'pc',   1,   1,   5,  'cactus'),
  (null, 'Avocado',              10, 'pc',   2,   2,   5,  'cactus'),
  -- Meat & Fish
  (null, 'Chicken Breast',       12, 'pc',   2,   2,   5,  'cactus'),
  (null, 'Ground Beef',          12, 'pc',   1,   1,   7,  'cactus'),
  (null, 'Salmon Fillet',        12, 'pc',   1,   1,   7,  'cactus'),
  -- Pantry
  (null, 'Basmati Rice',         14, 'kg',   1,   1,  14,  'cactus'),
  (null, 'Pasta',                14, 'kg',   1,   1,  14,  'cactus'),
  (null, 'Olive Oil',            14, 'L',    1,   1,  30,  'cactus'),
  (null, 'Sunflower Oil',        14, 'L',    1,   1,  30,  'cactus'),
  (null, 'Canned Tomatoes',      14, 'pc',   3,   2,   7,  'cactus'),
  (null, 'Lentils',              14, 'kg',   1,   1,  21,  'efarmz'),
  (null, 'Chickpeas (canned)',   14, 'pc',   2,   1,  10,  'cactus'),
  (null, 'Oat Flour',            14, 'kg',   1,   1,  21,  'efarmz'),
  (null, 'Plain Flour',          14, 'kg',   1,   1,  21,  'cactus'),
  (null, 'Sugar',                14, 'kg',   1,   1,  30,  'cactus'),
  (null, 'Salt',                 14, 'pc',   1,   1,  90,  'cactus'),
  -- Condiments
  (null, 'Ketchup',              18, 'pc',   1,   1,  30,  'cactus'),
  (null, 'Mustard',              18, 'pc',   1,   1,  45,  'cactus'),
  (null, 'Soy Sauce',            18, 'pc',   1,   1,  45,  'cactus'),
  -- Beverages
  (null, 'Sparkling Water',      16, 'L',    6,   6,   7,  'cactus'),
  (null, 'Still Water',          16, 'L',    6,   6,   7,  'cactus'),
  (null, 'Orange Juice',         16, 'L',    2,   1,   5,  'cactus'),
  -- Bakery
  (null, 'Bread',                13, 'pc',   1,   1,   3,  'cactus'),
  -- Snacks
  (null, 'Dark Chocolate',       17, 'pc',   2,   1,   7,  'cactus'),
  -- Cleaning — Laundry
  (null, 'Laundry Detergent',    30, 'pack', 1,   1,  30,  'amazon'),
  (null, 'Laundry Pods',         30, 'pc',  20,  20,  30,  'amazon'),
  (null, 'Fabric Softener',      30, 'L',    1,   1,  45,  'amazon'),
  -- Dishwashing
  (null, 'Dishwasher Tablets',   31, 'pc',  10,  30,  30,  'amazon'),
  (null, 'Washing-up Liquid',    31, 'pc',   1,   1,  30,  'cactus'),
  -- Surface
  (null, 'Multi-surface Spray',  32, 'pc',   1,   1,  30,  'amazon'),
  (null, 'Floor Cleaner',        32, 'L',    1,   1,  45,  'amazon'),
  -- Bathroom
  (null, 'Toilet Cleaner',       33, 'pc',   1,   1,  30,  'amazon'),
  -- Personal Care — Dental
  (null, 'Toothpaste',           22, 'pc',   1,   1,  60,  'amazon'),
  (null, 'Toothbrush',           22, 'pc',   2,   1,  90,  'amazon'),
  -- Hygiene
  (null, 'Shower Gel',           23, 'pc',   1,   1,  30,  'amazon'),
  (null, 'Shampoo',              21, 'pc',   1,   1,  30,  'amazon'),
  (null, 'Conditioner',          21, 'pc',   1,   1,  45,  'amazon'),
  (null, 'Hand Soap',            23, 'pc',   2,   1,  21,  'amazon'),
  (null, 'Deodorant',            23, 'pc',   1,   1,  30,  'amazon'),
  -- Baby & Kids
  (null, 'Diapers',              40, 'pc',  30,  30,  14,  'amazon'),
  (null, 'Baby Wipes',           40, 'pack', 2,   1,  14,  'amazon'),
  (null, 'Baby Formula',         41, 'pc',   2,   1,   7,  'amazon'),
  -- Household
  (null, 'Toilet Paper (12-roll)',50, 'pack', 1,   1,  14,  'amazon'),
  (null, 'Kitchen Roll',         50, 'pack', 1,   1,  14,  'amazon'),
  (null, 'Bin Bags',             50, 'pack', 1,   1,  30,  'amazon'),
  (null, 'AA Batteries',         51, 'pack', 1,   1,  90,  'amazon'),
  (null, 'LED Bulbs',            52, 'pc',   2,   1, 365,  'amazon');

-- ── products table: add manual burn pattern columns ──────────
alter table public.products
  add column if not exists manual_burn_qty          numeric default null,
  add column if not exists manual_burn_interval_days int    default null;
