-- ============================================================
-- HIRT — master_items expanded seed (run after master_items.sql)
-- Adds missing items and broader aliases for better categorisation
-- Run in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- Add missing Fresh Produce items
insert into public.master_items
  (user_id, name, category_id, unit, default_min_qty, default_burn_qty, default_burn_interval_days, default_vendor)
values
  -- Fresh Produce (10)
  (null, 'Ginger',                10, 'pc',  2,  1,  14, 'cactus'),
  (null, 'Cucumber',              10, 'pc',  2,  2,   5, 'cactus'),
  (null, 'Potatoes',              10, 'kg',  1,  1,   7, 'cactus'),
  (null, 'Sweet Potatoes',        10, 'pc',  3,  2,   7, 'cactus'),
  (null, 'Mushrooms',             10, 'pc',  2,  2,   5, 'cactus'),
  (null, 'Broccoli',              10, 'pc',  1,  1,   5, 'cactus'),
  (null, 'Courgette',             10, 'pc',  2,  2,   5, 'cactus'),
  (null, 'Zucchini',              10, 'pc',  2,  2,   5, 'cactus'),
  (null, 'Bell Pepper',           10, 'pc',  3,  3,   5, 'cactus'),
  (null, 'Lettuce',               10, 'pc',  1,  1,   4, 'cactus'),
  (null, 'Celery',                10, 'pc',  1,  1,   7, 'cactus'),
  (null, 'Leek',                  10, 'pc',  2,  2,   7, 'cactus'),
  (null, 'Pears',                 10, 'pc',  4,  4,   7, 'cactus'),
  (null, 'Oranges',               10, 'pc',  4,  4,   7, 'cactus'),
  (null, 'Strawberries',          10, 'pc',  1,  1,   4, 'cactus'),
  (null, 'Blueberries',           10, 'pc',  1,  1,   5, 'cactus'),
  (null, 'Grapes',                10, 'pc',  1,  1,   5, 'cactus'),
  (null, 'Mango',                 10, 'pc',  2,  2,   7, 'cactus'),
  (null, 'Pineapple',             10, 'pc',  1,  1,  10, 'cactus'),
  (null, 'Shallots',              10, 'pc',  3,  2,  10, 'cactus'),
  (null, 'Cherry Tomatoes',       10, 'pc',  2,  2,   5, 'cactus'),

  -- Dairy & Eggs (11)
  (null, 'Yogurt',                11, 'pc',  3,  2,   4, 'cactus'),
  (null, 'Plain Yogurt',          11, 'pc',  3,  2,   4, 'cactus'),
  (null, 'Skyr',                  11, 'pc',  2,  1,   5, 'cactus'),
  (null, 'Cottage Cheese',        11, 'pc',  1,  1,  10, 'cactus'),
  (null, 'Mozzarella',            11, 'pc',  2,  1,   7, 'cactus'),
  (null, 'Parmesan',              11, 'pc',  1,  1,  21, 'cactus'),
  (null, 'Whipping Cream',        11, 'L',   1,  1,  10, 'cactus'),
  (null, 'Sour Cream',            11, 'pc',  1,  1,  14, 'cactus'),
  (null, 'Almond Milk',           11, 'L',   2,  1,   7, 'cactus'),
  (null, 'Soy Milk',              11, 'L',   2,  1,   7, 'cactus'),

  -- Meat & Fish (12)
  (null, 'Ground Chicken',        12, 'pc',  1,  1,   7, 'cactus'),
  (null, 'Minced Chicken',        12, 'pc',  1,  1,   7, 'cactus'),
  (null, 'Minced Beef',           12, 'pc',  1,  1,   7, 'cactus'),
  (null, 'Chicken Thighs',        12, 'pc',  2,  2,   5, 'cactus'),
  (null, 'Chicken Fillet',        12, 'pc',  2,  2,   5, 'cactus'),
  (null, 'Chicken Filet',         12, 'pc',  2,  2,   5, 'cactus'),
  (null, 'Turkey',                12, 'pc',  1,  1,   7, 'cactus'),
  (null, 'Pork Chops',            12, 'pc',  2,  2,   7, 'cactus'),
  (null, 'Lamb',                  12, 'pc',  1,  1,   7, 'cactus'),
  (null, 'Cod',                   12, 'pc',  1,  1,   7, 'cactus'),
  (null, 'Skrei',                 12, 'pc',  1,  1,   7, 'cactus'),
  (null, 'Tuna',                  12, 'pc',  2,  1,   7, 'cactus'),
  (null, 'Tuna (canned)',         12, 'pc',  3,  1,   7, 'cactus'),
  (null, 'Shrimp',                12, 'pc',  1,  1,   7, 'cactus'),
  (null, 'Sea Bass',              12, 'pc',  1,  1,   7, 'cactus'),
  (null, 'Trout',                 12, 'pc',  1,  1,   7, 'cactus'),
  (null, 'Mackerel',              12, 'pc',  1,  1,   7, 'cactus'),

  -- Bakery (13)
  (null, 'Sourdough Bread',       13, 'pc',  1,  1,   3, 'cactus'),
  (null, 'Baguette',              13, 'pc',  2,  2,   2, 'cactus'),
  (null, 'Croissants',            13, 'pc',  4,  4,   3, 'cactus'),
  (null, 'Pita Bread',            13, 'pc',  4,  4,   5, 'cactus'),
  (null, 'Tortillas',             13, 'pc',  6,  6,   7, 'cactus'),
  (null, 'Crackers',              13, 'pack',1,  1,  14, 'cactus'),

  -- Pantry (14)
  (null, 'Whole Grain Rice',      14, 'kg',  1,  1,  14, 'cactus'),
  (null, 'Brown Rice',            14, 'kg',  1,  1,  14, 'cactus'),
  (null, 'Quinoa',                14, 'kg',  1,  1,  21, 'efarmz'),
  (null, 'Couscous',              14, 'kg',  1,  1,  21, 'cactus'),
  (null, 'Lentil Soup',           14, 'pc',  2,  1,   7, 'cactus'),
  (null, 'Coconut Milk',          14, 'pc',  2,  1,  14, 'cactus'),
  (null, 'Honey',                 14, 'pc',  1,  1,  30, 'cactus'),
  (null, 'Maple Syrup',           14, 'pc',  1,  1,  45, 'cactus'),
  (null, 'Vinegar',               14, 'pc',  1,  1,  60, 'cactus'),
  (null, 'Baking Powder',         14, 'pc',  1,  1,  90, 'cactus'),
  (null, 'Yeast',                 14, 'pc',  2,  1,  30, 'cactus'),
  (null, 'Breadcrumbs',           14, 'pc',  1,  1,  30, 'cactus'),
  (null, 'Cornstarch',            14, 'pc',  1,  1,  60, 'cactus'),

  -- Frozen (15)
  (null, 'Frozen Peas',           15, 'pack',1,  1,  21, 'cactus'),
  (null, 'Frozen Spinach',        15, 'pack',1,  1,  21, 'cactus'),
  (null, 'Frozen Fish',           15, 'pack',1,  1,  14, 'cactus'),
  (null, 'Ice Cream',             15, 'pc',  1,  1,  14, 'cactus'),

  -- Condiments (18)
  (null, 'Mayonnaise',            18, 'pc',  1,  1,  45, 'cactus'),
  (null, 'Hot Sauce',             18, 'pc',  1,  1,  60, 'cactus'),
  (null, 'Tahini',                18, 'pc',  1,  1,  30, 'cactus'),
  (null, 'Pesto',                 18, 'pc',  1,  1,  21, 'cactus'),
  (null, 'Curry Paste',           18, 'pc',  1,  1,  30, 'cactus'),
  (null, 'Fish Sauce',            18, 'pc',  1,  1,  60, 'cactus'),
  (null, 'Worcestershire Sauce',  18, 'pc',  1,  1,  90, 'cactus'),
  (null, 'Tomato Paste',          18, 'pc',  3,  1,   7, 'cactus'),
  (null, 'Harissa',               18, 'pc',  1,  1,  30, 'cactus')

on conflict do nothing;
