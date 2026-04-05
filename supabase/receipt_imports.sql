-- ============================================================
-- HIRT — receipt_imports table
-- Run this in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

create table if not exists public.receipt_imports (
  id           text        primary key default 'ri' || encode(gen_random_bytes(6), 'hex'),
  user_id      uuid        not null references auth.users(id) on delete cascade,
  vendor       text        not null default '',
  purchase_date date       not null,
  uploaded_at  timestamptz not null default now(),
  -- JSONB snapshot of every item the user confirmed, keyed by product_id (null = new item)
  -- Shape: [{ product_id, name, qty, unit, is_new }]
  items        jsonb       not null default '[]'::jsonb
);

alter table public.receipt_imports enable row level security;

create policy "Users read own imports"
  on public.receipt_imports for select
  using (auth.uid() = user_id);

create policy "Users insert own imports"
  on public.receipt_imports for insert
  with check (auth.uid() = user_id);

create policy "Users update own imports"
  on public.receipt_imports for update
  using (auth.uid() = user_id);

create policy "Users delete own imports"
  on public.receipt_imports for delete
  using (auth.uid() = user_id);
