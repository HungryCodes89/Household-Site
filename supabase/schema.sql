-- ─────────────────────────────────────────────────────────────────────────────
-- HouseHold Records — Financial Ops schema
-- Run this in Supabase Dashboard → SQL Editor → New query → paste → Run.
-- Idempotent: safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── transactions ────────────────────────────────────────────────────────────
create table if not exists public.transactions (
  id            uuid primary key default gen_random_uuid(),
  occurred_at   date         not null,
  kind          text         not null check (kind in ('income', 'expense')),
  amount        numeric(12,2) not null check (amount >= 0),
  description   text         not null default '',
  category      text,
  balance       numeric(12,2), -- running balance as recorded (optional, computed on read for the dashboard)
  created_by    uuid references auth.users(id) on delete set null,
  created_at    timestamptz  not null default now(),
  updated_at    timestamptz  not null default now()
);

create index if not exists transactions_occurred_at_idx on public.transactions (occurred_at);
create index if not exists transactions_kind_idx        on public.transactions (kind);
create index if not exists transactions_created_by_idx  on public.transactions (created_by);

-- Auto-update updated_at on row modification
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists transactions_set_updated_at on public.transactions;
create trigger transactions_set_updated_at
  before update on public.transactions
  for each row execute function public.set_updated_at();

-- ── meta / settings (singleton row for things like total_invested) ──────────
create table if not exists public.meta (
  id              int primary key default 1,
  total_invested  numeric(12,2) not null default 0,
  updated_at      timestamptz   not null default now(),
  constraint meta_singleton check (id = 1)
);

-- Seed the singleton if absent
insert into public.meta (id, total_invested)
values (1, 0)
on conflict (id) do nothing;

drop trigger if exists meta_set_updated_at on public.meta;
create trigger meta_set_updated_at
  before update on public.meta
  for each row execute function public.set_updated_at();

-- ── ROW LEVEL SECURITY ──────────────────────────────────────────────────────
-- Enable RLS on every table that holds business data.
-- Default-deny: without policies, no one can read or write.
alter table public.transactions enable row level security;
alter table public.meta         enable row level security;

-- Authenticated users get full access. (Single-user app — no per-row owner
-- check needed. If you ever add team members, restrict by created_by or a
-- separate org membership table.)
drop policy if exists "transactions: authenticated read"   on public.transactions;
drop policy if exists "transactions: authenticated write"  on public.transactions;
drop policy if exists "transactions: authenticated update" on public.transactions;
drop policy if exists "transactions: authenticated delete" on public.transactions;

create policy "transactions: authenticated read"
  on public.transactions for select
  to authenticated using (true);

create policy "transactions: authenticated write"
  on public.transactions for insert
  to authenticated with check (true);

create policy "transactions: authenticated update"
  on public.transactions for update
  to authenticated using (true) with check (true);

create policy "transactions: authenticated delete"
  on public.transactions for delete
  to authenticated using (true);

drop policy if exists "meta: authenticated read"   on public.meta;
drop policy if exists "meta: authenticated update" on public.meta;

create policy "meta: authenticated read"
  on public.meta for select
  to authenticated using (true);

create policy "meta: authenticated update"
  on public.meta for update
  to authenticated using (true) with check (true);

-- Explicit: anon role gets nothing. (RLS default-denies, this is just to be
-- crystal clear — no anon policies are defined above, so anon cannot read.)
-- If you ever see Supabase Studio warn about a missing policy for `anon`,
-- that's expected and correct here.

-- ── transaction_items ───────────────────────────────────────────────────────
-- Optional per-transaction line-item breakdowns (e.g. an invoice's individual
-- items). Items are descriptive and independent of the parent amount — the
-- dashboard flags drift but never auto-corrects. Parent amount is the source
-- of truth for what actually hit the bank.
create table if not exists public.transaction_items (
  id              uuid primary key default gen_random_uuid(),
  transaction_id  uuid not null references public.transactions(id) on delete cascade,
  item_name       text not null,
  quantity        int  not null default 1 check (quantity >= 1),
  unit_price      numeric(12,2) not null check (unit_price >= 0),
  notes           text,
  created_at      timestamptz not null default now()
);

create index if not exists transaction_items_transaction_id_idx
  on public.transaction_items (transaction_id);

alter table public.transaction_items enable row level security;

drop policy if exists "transaction_items: authenticated read"   on public.transaction_items;
drop policy if exists "transaction_items: authenticated write"  on public.transaction_items;
drop policy if exists "transaction_items: authenticated update" on public.transaction_items;
drop policy if exists "transaction_items: authenticated delete" on public.transaction_items;

create policy "transaction_items: authenticated read"
  on public.transaction_items for select
  to authenticated using (true);

create policy "transaction_items: authenticated write"
  on public.transaction_items for insert
  to authenticated with check (true);

create policy "transaction_items: authenticated update"
  on public.transaction_items for update
  to authenticated using (true) with check (true);

create policy "transaction_items: authenticated delete"
  on public.transaction_items for delete
  to authenticated using (true);
