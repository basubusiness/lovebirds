-- ============================================================
-- HIRT — consumption_log + vendor_schedules
-- Run in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- ── Consumption log ──────────────────────────────────────────
create table if not exists public.consumption_log (
  id          bigint      generated always as identity primary key,
  user_id     uuid        not null references auth.users(id) on delete cascade,
  product_id  text        not null references public.products(id) on delete cascade,
  qty_delta   numeric     not null,  -- negative = consume/finished, positive = restock
  log_type    text        not null default 'consume', -- consume | restock | finished
  logged_at   timestamptz not null default now()
);

alter table public.consumption_log enable row level security;

create policy "Users read own log"
  on public.consumption_log for select
  using (auth.uid() = user_id);

create policy "Users insert own log"
  on public.consumption_log for insert
  with check (auth.uid() = user_id);

-- index for fast per-product queries
create index if not exists consumption_log_product_idx
  on public.consumption_log (user_id, product_id, logged_at desc);

-- ── Vendor schedules ─────────────────────────────────────────
create table if not exists public.vendor_schedules (
  id            bigint      generated always as identity primary key,
  user_id       uuid        not null references auth.users(id) on delete cascade,
  vendor_id     text        not null,
  schedule_type text        not null default 'flexible', -- fixed | flexible
  day_of_week   int,        -- 0=Sun … 6=Sat, used when schedule_type='fixed'
  interval_days int,        -- used when schedule_type='flexible'
  next_order_date date,     -- manually overrideable next order date
  updated_at    timestamptz not null default now(),
  unique (user_id, vendor_id)
);

alter table public.vendor_schedules enable row level security;

create policy "Users read own schedules"
  on public.vendor_schedules for select
  using (auth.uid() = user_id);

create policy "Users insert own schedules"
  on public.vendor_schedules for insert
  with check (auth.uid() = user_id);

create policy "Users update own schedules"
  on public.vendor_schedules for update
  using (auth.uid() = user_id);

create policy "Users delete own schedules"
  on public.vendor_schedules for delete
  using (auth.uid() = user_id);
