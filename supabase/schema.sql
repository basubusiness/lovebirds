-- ============================================================
-- HIRT — Supabase Schema
-- Run this in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- Enable UUID generation
create extension if not exists "pgcrypto";

-- ── Products table ───────────────────────────────────────────
create table if not exists public.products (
  id           text        primary key default 'p' || encode(gen_random_bytes(6), 'hex'),
  user_id      uuid        not null references auth.users(id) on delete cascade,
  name         text        not null,
  cat          text        not null default 'Other',
  unit         text        not null default 'pc',
  min_qty      numeric     not null default 1,
  current_qty  numeric     not null default 0,
  vendor       text        not null default 'cactus',
  burn_rate    numeric     not null default 0,
  note         text        not null default '',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Keep updated_at fresh automatically
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger products_updated_at
  before update on public.products
  for each row execute procedure public.set_updated_at();

-- ── Row-Level Security ───────────────────────────────────────
-- Each user can only see and modify their own products.

alter table public.products enable row level security;

create policy "Users read own products"
  on public.products for select
  using (auth.uid() = user_id);

create policy "Users insert own products"
  on public.products for insert
  with check (auth.uid() = user_id);

create policy "Users update own products"
  on public.products for update
  using (auth.uid() = user_id);

create policy "Users delete own products"
  on public.products for delete
  using (auth.uid() = user_id);

-- ── Optional: consumption log ────────────────────────────────
-- Uncomment if you want to store history for burn rate analytics (P2)

-- create table if not exists public.consumption_log (
--   id          bigint      generated always as identity primary key,
--   user_id     uuid        not null references auth.users(id) on delete cascade,
--   product_id  text        not null references public.products(id) on delete cascade,
--   qty_delta   numeric     not null,  -- negative = consume, positive = restock
--   logged_at   timestamptz not null default now()
-- );
-- alter table public.consumption_log enable row level security;
-- create policy "Users read own log"   on public.consumption_log for select using (auth.uid() = user_id);
-- create policy "Users insert own log" on public.consumption_log for insert with check (auth.uid() = user_id);
