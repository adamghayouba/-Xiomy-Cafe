create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'pos_role') then
    create type public.pos_role as enum ('jefa', 'cajero');
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'payment_method') then
    create type public.payment_method as enum ('Efectivo', 'Transferencia');
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'client_pricing_type') then
    create type public.client_pricing_type as enum ('normal', 'familia', 'fiado');
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'sale_status') then
    create type public.sale_status as enum ('paid', 'discounted', 'pending');
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'sale_settlement_type') then
    create type public.sale_settlement_type as enum (
      'pago_normal',
      'consumo_familiar',
      'descuento_total',
      'cortesia',
      'fiado'
    );
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'sale_cancellation_request_status') then
    create type public.sale_cancellation_request_status as enum ('pending', 'approved', 'rejected');
  end if;
end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text,
  role public.pos_role not null default 'cajero',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null check (category in ('Bebidas', 'Comidas', 'Almuerzos')),
  subcategory text check (subcategory in ('Calientes', 'Frías', 'Alcohol') or subcategory is null),
  price numeric(12, 2) not null check (price >= 0),
  cost numeric(12, 2),
  description text not null default '',
  image text not null default '',
  active boolean not null default true,
  track_stock boolean not null default false,
  stock_quantity integer check (stock_quantity is null or stock_quantity >= 0),
  low_stock_threshold integer check (low_stock_threshold is null or low_stock_threshold >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  active boolean not null default true,
  pricing_type public.client_pricing_type not null default 'normal',
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  cashier_user_id uuid not null references auth.users(id) on delete restrict,
  client_id uuid references public.clients(id) on delete set null,
  payment_method public.payment_method,
  settlement_type public.sale_settlement_type not null default 'pago_normal',
  sale_status public.sale_status not null default 'paid',
  gross_total numeric(12, 2) not null default 0,
  discount_total numeric(12, 2) not null default 0,
  net_total numeric(12, 2) not null default 0,
  total numeric(12, 2) not null default 0,
  estimated_cost numeric(12, 2) not null default 0,
  gross_profit numeric(12, 2) not null default 0,
  items_count integer not null default 0,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  unit_price numeric(12, 2) not null,
  unit_cost numeric(12, 2),
  line_total numeric(12, 2) not null,
  line_cost_total numeric(12, 2) not null default 0,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.client_payments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  amount numeric(12, 2) not null check (amount > 0),
  payment_method public.payment_method not null,
  paid_by_name text,
  notes text,
  created_by_user_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.sale_cancellation_requests (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id) on delete cascade,
  requested_by_user_id uuid references auth.users(id) on delete set null,
  requested_by_label text not null,
  requested_at timestamptz not null default timezone('utc', now()),
  reason text,
  status public.sale_cancellation_request_status not null default 'pending',
  approved_by_user_id uuid references auth.users(id) on delete set null,
  approved_by_label text,
  approved_at timestamptz,
  rejected_at timestamptz,
  resolution_note text
);

create table if not exists public.cash_closeouts (
  id uuid primary key default gen_random_uuid(),
  cashier_user_id uuid not null references auth.users(id) on delete restrict,
  cashier_label text not null,
  closed_by_user_id uuid not null references auth.users(id) on delete restrict,
  closed_by_label text not null,
  business_date date not null,
  starting_cash numeric(12, 2) not null default 0,
  cash_sales numeric(12, 2) not null default 0,
  transfer_sales numeric(12, 2) not null default 0,
  fiado_generated numeric(12, 2) not null default 0,
  family_consumption numeric(12, 2) not null default 0,
  repayments_received numeric(12, 2) not null default 0,
  cancelled_sales numeric(12, 2) not null default 0,
  expected_cash numeric(12, 2) not null default 0,
  counted_cash numeric(12, 2) not null default 0,
  difference numeric(12, 2) not null default 0,
  notes text,
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.client_payments add column if not exists paid_by_name text;

alter table public.profiles add column if not exists full_name text;
alter table public.products add column if not exists description text not null default '';
alter table public.products add column if not exists image text not null default '';
alter table public.products add column if not exists active boolean not null default true;
alter table public.products add column if not exists track_stock boolean not null default false;
alter table public.products add column if not exists stock_quantity integer;
alter table public.products add column if not exists low_stock_threshold integer;
alter table public.products add column if not exists archived_at timestamptz;
alter table public.products add column if not exists updated_at timestamptz not null default timezone('utc', now());

alter table public.products drop constraint if exists products_price_check;
alter table public.products
  add constraint products_price_check
  check (price >= 0);

alter table public.clients add column if not exists full_name text;
alter table public.clients add column if not exists active boolean not null default true;
alter table public.clients add column if not exists pricing_type public.client_pricing_type not null default 'normal';
alter table public.clients add column if not exists notes text;
alter table public.clients add column if not exists created_at timestamptz not null default timezone('utc', now());
alter table public.clients add column if not exists updated_at timestamptz not null default timezone('utc', now());

alter table public.sales add column if not exists client_id uuid references public.clients(id) on delete set null;
alter table public.sales add column if not exists payment_method public.payment_method;
alter table public.sales add column if not exists settlement_type public.sale_settlement_type not null default 'pago_normal';
alter table public.sales add column if not exists sale_status public.sale_status not null default 'paid';
alter table public.sales add column if not exists gross_total numeric(12, 2) not null default 0;
alter table public.sales add column if not exists discount_total numeric(12, 2) not null default 0;
alter table public.sales add column if not exists net_total numeric(12, 2) not null default 0;
alter table public.sales add column if not exists total numeric(12, 2) not null default 0;
alter table public.sales add column if not exists estimated_cost numeric(12, 2) not null default 0;
alter table public.sales add column if not exists gross_profit numeric(12, 2) not null default 0;
alter table public.sales add column if not exists items_count integer not null default 0;
alter table public.sales add column if not exists is_cancelled boolean not null default false;
alter table public.sales add column if not exists cancellation_reason text;
alter table public.sales add column if not exists cancellation_requested_by_user_id uuid references auth.users(id) on delete set null;
alter table public.sales add column if not exists cancellation_requested_by_label text;
alter table public.sales add column if not exists cancellation_requested_at timestamptz;
alter table public.sales add column if not exists cancellation_request_status public.sale_cancellation_request_status;
alter table public.sales add column if not exists cancellation_approved_by_user_id uuid references auth.users(id) on delete set null;
alter table public.sales add column if not exists cancellation_approved_by_label text;
alter table public.sales add column if not exists cancellation_approved_at timestamptz;
alter table public.sales alter column payment_method drop not null;

update public.sales
set
  gross_total = coalesce(nullif(gross_total, 0), total),
  net_total = coalesce(nullif(net_total, 0), total),
  settlement_type = case
    when sale_status = 'discounted'::public.sale_status then 'consumo_familiar'::public.sale_settlement_type
    when sale_status = 'pending'::public.sale_status then 'fiado'::public.sale_settlement_type
    else coalesce(settlement_type, 'pago_normal'::public.sale_settlement_type)
  end,
  total = coalesce(net_total, total),
  sale_status = case
    when coalesce(discount_total, 0) > 0 then 'discounted'::public.sale_status
    else coalesce(sale_status, 'paid'::public.sale_status)
  end;

create index if not exists idx_products_category on public.products(category);
create index if not exists idx_products_active on public.products(active);
create index if not exists idx_clients_active on public.clients(active);
create index if not exists idx_clients_pricing_type on public.clients(pricing_type);
create unique index if not exists idx_clients_full_name_unique on public.clients (lower(full_name));
create index if not exists idx_sales_created_at on public.sales(created_at desc);
create index if not exists idx_sales_cashier on public.sales(cashier_user_id);
create index if not exists idx_sales_client on public.sales(client_id);
create index if not exists idx_sale_items_sale on public.sale_items(sale_id);
create index if not exists idx_client_payments_client on public.client_payments(client_id);
create index if not exists idx_client_payments_created_at on public.client_payments(created_at desc);
create index if not exists idx_sale_cancellation_requests_sale on public.sale_cancellation_requests(sale_id);
create index if not exists idx_sale_cancellation_requests_status on public.sale_cancellation_requests(status, requested_at desc);
create unique index if not exists idx_sale_cancellation_requests_pending_unique on public.sale_cancellation_requests(sale_id) where status = 'pending';
create index if not exists idx_cash_closeouts_cashier_date on public.cash_closeouts(cashier_user_id, business_date desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists set_products_updated_at on public.products;
create trigger set_products_updated_at
before update on public.products
for each row execute function public.set_updated_at();

drop trigger if exists set_clients_updated_at on public.clients;
create trigger set_clients_updated_at
before update on public.clients
for each row execute function public.set_updated_at();

