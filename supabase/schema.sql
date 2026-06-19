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
  reviewed_by_user_id uuid references auth.users(id) on delete set null,
  reviewed_by_label text,
  reviewed_at timestamptz,
  notes text,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.cash_withdrawals (
  id uuid primary key default gen_random_uuid(),
  business_date date not null,
  amount numeric(12, 2) not null check (amount > 0),
  scope text not null default 'shift' check (scope in ('shift', 'accumulated')),
  note text,
  created_by_user_id uuid not null references auth.users(id) on delete restrict,
  created_by_label text not null,
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.client_payments add column if not exists paid_by_name text;
alter table public.cash_withdrawals add column if not exists scope text not null default 'shift';
alter table public.cash_withdrawals drop constraint if exists cash_withdrawals_scope_check;
alter table public.cash_withdrawals
  add constraint cash_withdrawals_scope_check
  check (scope in ('shift', 'accumulated'));

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
alter table public.cash_closeouts add column if not exists reviewed_by_user_id uuid references auth.users(id) on delete set null;
alter table public.cash_closeouts add column if not exists reviewed_by_label text;
alter table public.cash_closeouts add column if not exists reviewed_at timestamptz;

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
create index if not exists idx_cash_withdrawals_creator_date on public.cash_withdrawals(created_by_user_id, business_date desc);

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

create or replace function public.current_user_role()
returns public.pos_role
language sql
stable
as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    coalesce(new.email, ''),
    nullif(new.raw_user_meta_data->>'full_name', ''),
    coalesce((new.raw_app_meta_data->>'role')::public.pos_role, 'cajero')
  )
  on conflict (id) do update
  set
    email = excluded.email,
    full_name = excluded.full_name,
    role = excluded.role;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.clients enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.client_payments enable row level security;
alter table public.sale_cancellation_requests enable row level security;
alter table public.cash_closeouts enable row level security;
alter table public.cash_withdrawals enable row level security;

drop policy if exists "profiles_self_select" on public.profiles;
create policy "profiles_self_select"
on public.profiles
for select
to authenticated
using (id = auth.uid());

drop policy if exists "products_select_for_staff" on public.products;
create policy "products_select_for_staff"
on public.products
for select
to authenticated
using (active = true or public.current_user_role() = 'jefa');

drop policy if exists "products_insert_for_jefa" on public.products;
create policy "products_insert_for_jefa"
on public.products
for insert
to authenticated
with check (public.current_user_role() = 'jefa');

drop policy if exists "products_update_for_jefa" on public.products;
create policy "products_update_for_jefa"
on public.products
for update
to authenticated
using (public.current_user_role() = 'jefa')
with check (public.current_user_role() = 'jefa');

drop policy if exists "products_delete_for_jefa" on public.products;
create policy "products_delete_for_jefa"
on public.products
for delete
to authenticated
using (public.current_user_role() = 'jefa');

drop policy if exists "clients_select_for_staff" on public.clients;
create policy "clients_select_for_staff"
on public.clients
for select
to authenticated
using (active = true or public.current_user_role() = 'jefa');

drop policy if exists "clients_insert_for_jefa" on public.clients;
create policy "clients_insert_for_jefa"
on public.clients
for insert
to authenticated
with check (public.current_user_role() = 'jefa');

drop policy if exists "clients_update_for_jefa" on public.clients;
create policy "clients_update_for_jefa"
on public.clients
for update
to authenticated
using (public.current_user_role() = 'jefa')
with check (public.current_user_role() = 'jefa');

drop policy if exists "sales_select_for_jefa" on public.sales;
drop policy if exists "sales_select_own_for_cajero" on public.sales;
drop policy if exists "sales_select_for_father_tab_staff" on public.sales;
create policy "sales_select_for_jefa"
on public.sales
for select
to authenticated
using (public.current_user_role() = 'jefa');

create policy "sales_select_own_for_cajero"
on public.sales
for select
to authenticated
using (
  public.current_user_role() = 'cajero'
  and cashier_user_id = auth.uid()
);

create policy "sales_select_for_father_tab_staff"
on public.sales
for select
to authenticated
using (
  public.current_user_role() in ('jefa', 'cajero')
  and exists (
    select 1
    from public.clients
    where clients.id = sales.client_id
      and clients.pricing_type = 'fiado'
  )
);

drop policy if exists "sale_items_select_for_jefa" on public.sale_items;
drop policy if exists "sale_items_select_own_for_cajero" on public.sale_items;
drop policy if exists "sale_items_select_for_father_tab_staff" on public.sale_items;
create policy "sale_items_select_for_jefa"
on public.sale_items
for select
to authenticated
using (public.current_user_role() = 'jefa');

create policy "sale_items_select_own_for_cajero"
on public.sale_items
for select
to authenticated
using (
  public.current_user_role() = 'cajero'
  and exists (
    select 1
    from public.sales
    where sales.id = sale_items.sale_id
      and sales.cashier_user_id = auth.uid()
  )
);

create policy "sale_items_select_for_father_tab_staff"
on public.sale_items
for select
to authenticated
using (
  public.current_user_role() in ('jefa', 'cajero')
  and exists (
    select 1
    from public.sales
    join public.clients on clients.id = sales.client_id
    where sales.id = sale_items.sale_id
      and clients.pricing_type = 'fiado'
  )
);

drop policy if exists "client_payments_select_for_jefa" on public.client_payments;
drop policy if exists "client_payments_select_for_father_tab_staff" on public.client_payments;
create policy "client_payments_select_for_jefa"
on public.client_payments
for select
to authenticated
using (public.current_user_role() = 'jefa');

create policy "client_payments_select_for_father_tab_staff"
on public.client_payments
for select
to authenticated
using (
  public.current_user_role() in ('jefa', 'cajero')
  and exists (
    select 1
    from public.clients
    where clients.id = client_payments.client_id
      and clients.pricing_type = 'fiado'
  )
);

drop policy if exists "client_payments_insert_for_jefa" on public.client_payments;
drop policy if exists "client_payments_insert_for_father_tab_staff" on public.client_payments;
create policy "client_payments_insert_for_jefa"
on public.client_payments
for insert
to authenticated
with check (public.current_user_role() = 'jefa');

create policy "client_payments_insert_for_father_tab_staff"
on public.client_payments
for insert
to authenticated
with check (
  public.current_user_role() in ('jefa', 'cajero')
  and exists (
    select 1
    from public.clients
    where clients.id = client_payments.client_id
      and clients.pricing_type = 'fiado'
  )
);

drop policy if exists "sale_cancellation_requests_select_for_jefa" on public.sale_cancellation_requests;
drop policy if exists "sale_cancellation_requests_select_own" on public.sale_cancellation_requests;
create policy "sale_cancellation_requests_select_for_jefa"
on public.sale_cancellation_requests
for select
to authenticated
using (public.current_user_role() = 'jefa');

create policy "sale_cancellation_requests_select_own"
on public.sale_cancellation_requests
for select
to authenticated
using (
  public.current_user_role() = 'cajero'
  and requested_by_user_id = auth.uid()
);

drop policy if exists "cash_closeouts_select_for_jefa" on public.cash_closeouts;
drop policy if exists "cash_closeouts_select_own" on public.cash_closeouts;
create policy "cash_closeouts_select_for_jefa"
on public.cash_closeouts
for select
to authenticated
using (public.current_user_role() = 'jefa');

create policy "cash_closeouts_select_own"
on public.cash_closeouts
for select
to authenticated
using (
  public.current_user_role() = 'cajero'
  and cashier_user_id = auth.uid()
);

drop policy if exists "cash_withdrawals_select_for_jefa" on public.cash_withdrawals;
drop policy if exists "cash_withdrawals_select_own" on public.cash_withdrawals;
create policy "cash_withdrawals_select_for_jefa"
on public.cash_withdrawals
for select
to authenticated
using (public.current_user_role() = 'jefa');

create policy "cash_withdrawals_select_own"
on public.cash_withdrawals
for select
to authenticated
using (
  public.current_user_role() = 'cajero'
  and created_by_user_id = auth.uid()
);

drop policy if exists "cash_withdrawals_insert_for_pos_staff" on public.cash_withdrawals;
create policy "cash_withdrawals_insert_for_pos_staff"
on public.cash_withdrawals
for insert
to authenticated
with check (
  public.current_user_role() in ('jefa', 'cajero')
  and created_by_user_id = auth.uid()
);

drop function if exists public.create_sale(public.payment_method, jsonb);
drop function if exists public.create_sale(public.payment_method, jsonb, uuid);
drop function if exists public.create_sale(public.payment_method, public.sale_settlement_type, jsonb, uuid);

create or replace function public.create_sale(
  p_payment_method public.payment_method default null,
  p_settlement_type public.sale_settlement_type default 'pago_normal',
  p_items jsonb default '[]'::jsonb,
  p_client_id uuid default null
)
returns public.sales
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_role public.pos_role;
  v_sale public.sales%rowtype;
  v_item jsonb;
  v_product public.products%rowtype;
  v_client public.clients%rowtype;
  v_gross_total numeric(12, 2) := 0;
  v_discount_total numeric(12, 2) := 0;
  v_net_total numeric(12, 2) := 0;
  v_estimated_cost numeric(12, 2) := 0;
  v_items_count integer := 0;
  v_quantity integer;
  v_sale_status public.sale_status := 'paid';
  v_payment_method public.payment_method := p_payment_method;
  v_settlement_type public.sale_settlement_type := coalesce(p_settlement_type, 'pago_normal'::public.sale_settlement_type);
begin
  if v_user_id is null then
    raise exception 'No authenticated user for sale creation.';
  end if;

  select role into v_role
  from public.profiles
  where id = v_user_id;

  if v_role not in ('jefa', 'cajero') then
    raise exception 'User does not have POS permissions.';
  end if;

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Sale items are required.';
  end if;

  if p_client_id is not null then
    select *
    into v_client
    from public.clients
    where id = p_client_id
      and active = true;

    if not found then
      raise exception 'Selected client is not available.';
    end if;
  end if;

  if v_client.pricing_type = 'familia' then
    v_sale_status := 'discounted';
    if v_settlement_type = 'pago_normal' then
      v_settlement_type := 'consumo_familiar';
    end if;
  elsif v_client.pricing_type = 'fiado' then
    v_sale_status := 'pending';
    v_settlement_type := 'fiado';
  end if;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_quantity := greatest(1, coalesce((v_item->>'quantity')::integer, 0));

    select *
    into v_product
    from public.products
    where id = (v_item->>'product_id')::uuid
      and active = true;

    if not found then
      raise exception 'Product % is not available for sale.', v_item->>'product_id';
    end if;

    if coalesce(v_product.price, 0) <= 0 then
      raise exception 'Precio pendiente para %.', v_product.name;
    end if;

    if coalesce(v_product.track_stock, false) and coalesce(v_product.stock_quantity, 0) < v_quantity then
      raise exception 'Stock insuficiente para %.', v_product.name;
    end if;

    v_gross_total := v_gross_total + (v_product.price * v_quantity);
    v_estimated_cost := v_estimated_cost + (coalesce(v_product.cost, 0) * v_quantity);
    v_items_count := v_items_count + v_quantity;
  end loop;

  if v_sale_status = 'discounted' then
    v_discount_total := v_gross_total;
    v_net_total := 0;
    v_payment_method := null;
    if v_settlement_type = 'pago_normal' then
      v_settlement_type := 'descuento_total';
    end if;
  elsif v_sale_status = 'pending' then
    v_discount_total := 0;
    v_net_total := 0;
    v_payment_method := null;
    v_settlement_type := 'fiado';
  else
    v_discount_total := 0;
    v_net_total := v_gross_total;
    v_settlement_type := 'pago_normal';

    if v_payment_method is null then
      raise exception 'Payment method is required for paid sales.';
    end if;
  end if;

  insert into public.sales (
    cashier_user_id,
    client_id,
    payment_method,
    settlement_type,
    sale_status,
    gross_total,
    discount_total,
    net_total,
    total,
    estimated_cost,
    gross_profit,
    items_count
  )
  values (
    v_user_id,
    p_client_id,
    v_payment_method,
    v_settlement_type,
    v_sale_status,
    v_gross_total,
    v_discount_total,
    v_net_total,
    v_net_total,
    v_estimated_cost,
    v_net_total - v_estimated_cost,
    v_items_count
  )
  returning * into v_sale;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_quantity := greatest(1, coalesce((v_item->>'quantity')::integer, 0));

    select *
    into v_product
    from public.products
    where id = (v_item->>'product_id')::uuid
      and active = true;

    insert into public.sale_items (
      sale_id,
      product_id,
      quantity,
      unit_price,
      unit_cost,
      line_total,
      line_cost_total
    )
    values (
      v_sale.id,
      v_product.id,
      v_quantity,
      v_product.price,
      v_product.cost,
      v_product.price * v_quantity,
      coalesce(v_product.cost, 0) * v_quantity
    );

    if coalesce(v_product.track_stock, false) then
      update public.products
      set stock_quantity = greatest(coalesce(stock_quantity, 0) - v_quantity, 0)
      where id = v_product.id;
    end if;
  end loop;

  return v_sale;
end;
$$;

grant execute on function public.create_sale(public.payment_method, public.sale_settlement_type, jsonb, uuid) to authenticated;

drop function if exists public.record_client_payment(uuid, numeric, public.payment_method, text);
drop function if exists public.record_client_payment(uuid, numeric, public.payment_method, text, text);

create or replace function public.record_client_payment(
  p_client_id uuid,
  p_amount numeric,
  p_payment_method public.payment_method,
  p_paid_by_name text default null,
  p_notes text default null
)
returns public.client_payments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_role public.pos_role;
  v_client public.clients%rowtype;
  v_total_tab_sales numeric(12, 2) := 0;
  v_total_repayments numeric(12, 2) := 0;
  v_balance numeric(12, 2) := 0;
  v_payment public.client_payments%rowtype;
begin
  if v_user_id is null then
    raise exception 'No authenticated user for payment recording.';
  end if;

  select role into v_role
  from public.profiles
  where id = v_user_id;

  if v_role not in ('jefa', 'cajero') then
    raise exception 'User does not have POS permissions.';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Payment amount must be greater than zero.';
  end if;

  select *
  into v_client
  from public.clients
  where id = p_client_id
    and active = true;

  if not found then
    raise exception 'Selected client is not available.';
  end if;

  if v_client.pricing_type <> 'fiado' then
    raise exception 'Solo los clientes con cuenta fiado pueden registrar pagos a cuenta.';
  end if;

  select coalesce(sum(gross_total), 0)
  into v_total_tab_sales
  from public.sales
  where client_id = p_client_id
    and sale_status = 'pending';

  select coalesce(sum(amount), 0)
  into v_total_repayments
  from public.client_payments
  where client_id = p_client_id;

  v_balance := greatest(v_total_tab_sales - v_total_repayments, 0);

  if p_amount > v_balance then
    raise exception 'Payment amount exceeds outstanding balance.';
  end if;

  insert into public.client_payments (
    client_id,
    amount,
    payment_method,
    paid_by_name,
    notes,
    created_by_user_id
  )
  values (
    p_client_id,
    p_amount,
    p_payment_method,
    nullif(trim(coalesce(p_paid_by_name, '')), ''),
    nullif(p_notes, ''),
    v_user_id
  )
  returning * into v_payment;

  return v_payment;
end;
$$;

grant execute on function public.record_client_payment(uuid, numeric, public.payment_method, text, text) to authenticated;

drop function if exists public.request_sale_cancellation(uuid, text);

create or replace function public.request_sale_cancellation(
  p_sale_id uuid,
  p_reason text default null
)
returns public.sale_cancellation_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_role public.pos_role;
  v_sale public.sales%rowtype;
  v_profile public.profiles%rowtype;
  v_request public.sale_cancellation_requests%rowtype;
  v_label text;
begin
  if v_user_id is null then
    raise exception 'No authenticated user for cancellation request.';
  end if;

  select * into v_profile
  from public.profiles
  where id = v_user_id;

  v_role := v_profile.role;

  if v_role not in ('jefa', 'cajero') then
    raise exception 'User does not have POS permissions.';
  end if;

  select *
  into v_sale
  from public.sales
  where id = p_sale_id;

  if not found then
    raise exception 'La venta seleccionada no existe.';
  end if;

  if v_role = 'cajero' and v_sale.cashier_user_id <> v_user_id then
    raise exception 'Solo puedes solicitar anulacion de tus propias ventas.';
  end if;

  if v_sale.is_cancelled then
    raise exception 'La venta ya fue anulada.';
  end if;

  if v_sale.created_at < timezone('utc', now()) - interval '30 minutes' then
    raise exception 'La anulacion solo puede solicitarse dentro de los primeros 30 minutos.';
  end if;

  if exists (
    select 1
    from public.sale_cancellation_requests
    where sale_id = p_sale_id
      and status = 'pending'
  ) then
    raise exception 'Ya existe una solicitud pendiente para esta venta.';
  end if;

  v_label := coalesce(nullif(trim(coalesce(v_profile.full_name, '')), ''), nullif(trim(coalesce(v_profile.email, '')), ''), 'Cajera');

  insert into public.sale_cancellation_requests (
    sale_id,
    requested_by_user_id,
    requested_by_label,
    reason,
    status
  )
  values (
    p_sale_id,
    v_user_id,
    v_label,
    nullif(trim(coalesce(p_reason, '')), ''),
    'pending'
  )
  returning * into v_request;

  update public.sales
  set
    cancellation_reason = v_request.reason,
    cancellation_requested_by_user_id = v_user_id,
    cancellation_requested_by_label = v_label,
    cancellation_requested_at = v_request.requested_at,
    cancellation_request_status = 'pending'
  where id = p_sale_id;

  return v_request;
end;
$$;

grant execute on function public.request_sale_cancellation(uuid, text) to authenticated;

drop function if exists public.resolve_sale_cancellation_request(uuid, boolean, text);

create or replace function public.resolve_sale_cancellation_request(
  p_request_id uuid,
  p_approve boolean,
  p_resolution_note text default null
)
returns public.sale_cancellation_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_role public.pos_role;
  v_profile public.profiles%rowtype;
  v_request public.sale_cancellation_requests%rowtype;
  v_sale public.sales%rowtype;
  v_item record;
  v_label text;
begin
  if v_user_id is null then
    raise exception 'No authenticated user for cancellation approval.';
  end if;

  select * into v_profile
  from public.profiles
  where id = v_user_id;

  v_role := v_profile.role;

  if v_role <> 'jefa' then
    raise exception 'Solo jefa puede resolver anulaciones.';
  end if;

  select *
  into v_request
  from public.sale_cancellation_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'La solicitud de anulacion no existe.';
  end if;

  if v_request.status <> 'pending' then
    raise exception 'La solicitud ya fue resuelta.';
  end if;

  select *
  into v_sale
  from public.sales
  where id = v_request.sale_id
  for update;

  if not found then
    raise exception 'La venta asociada no existe.';
  end if;

  v_label := coalesce(nullif(trim(coalesce(v_profile.full_name, '')), ''), nullif(trim(coalesce(v_profile.email, '')), ''), 'Jefa');

  if p_approve then
    if not v_sale.is_cancelled then
      for v_item in
        select
          sale_items.product_id,
          sale_items.quantity,
          products.track_stock
        from public.sale_items
        join public.products on products.id = sale_items.product_id
        where sale_items.sale_id = v_sale.id
      loop
        if coalesce(v_item.track_stock, false) then
          update public.products
          set stock_quantity = coalesce(stock_quantity, 0) + v_item.quantity
          where id = v_item.product_id;
        end if;
      end loop;
    end if;

    update public.sale_cancellation_requests
    set
      status = 'approved',
      approved_by_user_id = v_user_id,
      approved_by_label = v_label,
      approved_at = timezone('utc', now()),
      resolution_note = nullif(trim(coalesce(p_resolution_note, '')), '')
    where id = p_request_id
    returning * into v_request;

    update public.sales
    set
      is_cancelled = true,
      cancellation_reason = coalesce(v_request.reason, cancellation_reason),
      cancellation_requested_by_user_id = coalesce(cancellation_requested_by_user_id, v_request.requested_by_user_id),
      cancellation_requested_by_label = coalesce(cancellation_requested_by_label, v_request.requested_by_label),
      cancellation_requested_at = coalesce(cancellation_requested_at, v_request.requested_at),
      cancellation_request_status = 'approved',
      cancellation_approved_by_user_id = v_user_id,
      cancellation_approved_by_label = v_label,
      cancellation_approved_at = v_request.approved_at
    where id = v_request.sale_id;
  else
    update public.sale_cancellation_requests
    set
      status = 'rejected',
      approved_by_user_id = v_user_id,
      approved_by_label = v_label,
      rejected_at = timezone('utc', now()),
      resolution_note = nullif(trim(coalesce(p_resolution_note, '')), '')
    where id = p_request_id
    returning * into v_request;

    update public.sales
    set
      cancellation_request_status = 'rejected'
    where id = v_request.sale_id;
  end if;

  return v_request;
end;
$$;

grant execute on function public.resolve_sale_cancellation_request(uuid, boolean, text) to authenticated;

drop function if exists public.cash_closeout_snapshot(numeric);

create or replace function public.cash_closeout_snapshot(
  p_starting_cash numeric default 0
)
returns table (
  business_date date,
  starting_cash numeric,
  cash_sales numeric,
  transfer_sales numeric,
  fiado_generated numeric,
  family_consumption numeric,
  repayments_received numeric,
  cash_withdrawals numeric,
  cancelled_sales numeric,
  expected_cash numeric,
  accumulated_cash numeric,
  total_available_cash numeric
)
language sql
security definer
set search_path = public
as $$
  with scope as (
    select
      auth.uid() as user_id,
      (timezone('America/Bogota', now()))::date as business_date,
      date_trunc('day', timezone('America/Bogota', now())) at time zone 'America/Bogota' as start_ts,
      (date_trunc('day', timezone('America/Bogota', now())) + interval '1 day') at time zone 'America/Bogota' as end_ts
  ),
  last_closeout as (
    select closeouts.created_at
    from scope
    join public.cash_closeouts as closeouts
      on closeouts.cashier_user_id = scope.user_id
     and closeouts.business_date = scope.business_date
    order by closeouts.created_at desc
    limit 1
  ),
  effective_scope as (
    select
      scope.user_id,
      scope.business_date,
      coalesce(last_closeout.created_at, scope.start_ts) as effective_start_ts,
      scope.end_ts
    from scope
    left join last_closeout on true
  ),
  sales_totals as (
    select
      coalesce(sum(case when sales.sale_status = 'paid' and sales.payment_method = 'Efectivo' and not sales.is_cancelled then sales.net_total else 0 end), 0) as cash_sales,
      coalesce(sum(case when sales.sale_status = 'paid' and sales.payment_method = 'Transferencia' and not sales.is_cancelled then sales.net_total else 0 end), 0) as transfer_sales,
      coalesce(sum(case when sales.sale_status = 'pending' and not sales.is_cancelled then sales.gross_total else 0 end), 0) as fiado_generated,
      coalesce(sum(case when sales.sale_status = 'discounted' and not sales.is_cancelled then sales.gross_total else 0 end), 0) as family_consumption,
      coalesce(sum(case when sales.is_cancelled and sales.cancellation_approved_at >= effective_scope.effective_start_ts and sales.cancellation_approved_at < effective_scope.end_ts then sales.gross_total else 0 end), 0) as cancelled_sales
    from effective_scope
    left join public.sales on sales.cashier_user_id = effective_scope.user_id
      and sales.created_at >= effective_scope.effective_start_ts
      and sales.created_at < effective_scope.end_ts
  ),
  payment_totals as (
    select
      coalesce(sum(amount), 0) as repayments_received,
      coalesce(sum(case when payment_method = 'Efectivo' then amount else 0 end), 0) as repayments_cash
    from effective_scope
    left join public.client_payments on client_payments.created_by_user_id = effective_scope.user_id
      and client_payments.created_at >= effective_scope.effective_start_ts
      and client_payments.created_at < effective_scope.end_ts
  ),
  withdrawal_totals as (
    select
      coalesce(sum(case when cash_withdrawals.scope = 'shift' then amount else 0 end), 0) as cash_withdrawals
    from effective_scope
    left join public.cash_withdrawals on cash_withdrawals.created_by_user_id = effective_scope.user_id
      and cash_withdrawals.created_at >= effective_scope.effective_start_ts
      and cash_withdrawals.created_at < effective_scope.end_ts
  ),
  accumulated_closeout_totals as (
    select
      coalesce(sum(counted_cash), 0) as accumulated_closed_cash
    from scope
    left join public.cash_closeouts on cash_closeouts.cashier_user_id = scope.user_id
      and cash_closeouts.created_at < scope.start_ts
  ),
  accumulated_withdrawal_totals as (
    select
      coalesce(sum(amount), 0) as accumulated_withdrawals
    from scope
    left join public.cash_withdrawals on cash_withdrawals.created_by_user_id = scope.user_id
      and cash_withdrawals.scope = 'accumulated'
      and cash_withdrawals.created_at < scope.end_ts
  )
  select
    effective_scope.business_date,
    coalesce(p_starting_cash, 0)::numeric(12, 2) as starting_cash,
    sales_totals.cash_sales,
    sales_totals.transfer_sales,
    sales_totals.fiado_generated,
    sales_totals.family_consumption,
    payment_totals.repayments_received,
    withdrawal_totals.cash_withdrawals,
    sales_totals.cancelled_sales,
    (coalesce(p_starting_cash, 0) + sales_totals.cash_sales + payment_totals.repayments_cash - withdrawal_totals.cash_withdrawals)::numeric(12, 2) as expected_cash,
    greatest(
      accumulated_closeout_totals.accumulated_closed_cash - accumulated_withdrawal_totals.accumulated_withdrawals,
      0
    )::numeric(12, 2) as accumulated_cash,
    (
      (coalesce(p_starting_cash, 0) + sales_totals.cash_sales + payment_totals.repayments_cash - withdrawal_totals.cash_withdrawals)
      + greatest(
          accumulated_closeout_totals.accumulated_closed_cash - accumulated_withdrawal_totals.accumulated_withdrawals,
          0
        )
    )::numeric(12, 2) as total_available_cash
  from effective_scope, sales_totals, payment_totals, withdrawal_totals, accumulated_closeout_totals, accumulated_withdrawal_totals;
$$;

grant execute on function public.cash_closeout_snapshot(numeric) to authenticated;

drop function if exists public.create_cash_closeout(numeric, numeric, text);

create or replace function public.create_cash_closeout(
  p_starting_cash numeric,
  p_counted_cash numeric,
  p_notes text default null
)
returns public.cash_closeouts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_role public.pos_role;
  v_profile public.profiles%rowtype;
  v_snapshot record;
  v_closeout public.cash_closeouts%rowtype;
  v_label text;
begin
  if v_user_id is null then
    raise exception 'No authenticated user for cash closeout.';
  end if;

  select * into v_profile
  from public.profiles
  where id = v_user_id;

  v_role := v_profile.role;

  if v_role not in ('jefa', 'cajero') then
    raise exception 'User does not have POS permissions.';
  end if;

  if p_counted_cash is null or p_counted_cash < 0 then
    raise exception 'El efectivo contado debe ser mayor o igual a cero.';
  end if;

  select * into v_snapshot
  from public.cash_closeout_snapshot(coalesce(p_starting_cash, 0));

  v_label := coalesce(nullif(trim(coalesce(v_profile.full_name, '')), ''), nullif(trim(coalesce(v_profile.email, '')), ''), 'Caja');

  insert into public.cash_closeouts (
    cashier_user_id,
    cashier_label,
    closed_by_user_id,
    closed_by_label,
    business_date,
    starting_cash,
    cash_sales,
    transfer_sales,
    fiado_generated,
    family_consumption,
    repayments_received,
    cancelled_sales,
    expected_cash,
    counted_cash,
    difference,
    notes
  )
  values (
    v_user_id,
    v_label,
    v_user_id,
    v_label,
    v_snapshot.business_date,
    coalesce(p_starting_cash, 0),
    v_snapshot.cash_sales,
    v_snapshot.transfer_sales,
    v_snapshot.fiado_generated,
    v_snapshot.family_consumption,
    v_snapshot.repayments_received,
    v_snapshot.cancelled_sales,
    v_snapshot.expected_cash,
    p_counted_cash,
    p_counted_cash - v_snapshot.expected_cash,
    nullif(trim(coalesce(p_notes, '')), '')
  )
  returning * into v_closeout;

  return v_closeout;
end;
$$;

grant execute on function public.create_cash_closeout(numeric, numeric, text) to authenticated;

drop function if exists public.create_cash_withdrawal(numeric, text);
drop function if exists public.create_cash_withdrawal(numeric, text, text);

create or replace function public.create_cash_withdrawal(
  p_amount numeric,
  p_scope text default 'shift',
  p_note text default null
)
returns public.cash_withdrawals
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_role public.pos_role;
  v_profile public.profiles%rowtype;
  v_withdrawal public.cash_withdrawals%rowtype;
  v_label text;
  v_business_date date := (timezone('America/Bogota', now()))::date;
  v_scope text := coalesce(nullif(trim(coalesce(p_scope, '')), ''), 'shift');
  v_available_accumulated numeric(12, 2) := 0;
begin
  if v_user_id is null then
    raise exception 'No authenticated user for cash withdrawal.';
  end if;

  select * into v_profile
  from public.profiles
  where id = v_user_id;

  v_role := v_profile.role;

  if v_role not in ('jefa', 'cajero') then
    raise exception 'User does not have POS permissions.';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'El monto de la salida debe ser mayor a cero.';
  end if;

  if v_scope not in ('shift', 'accumulated') then
    raise exception 'Tipo de retiro no válido.';
  end if;

  if v_scope = 'accumulated' then
    select accumulated_cash
    into v_available_accumulated
    from public.cash_closeout_snapshot(0);

    if p_amount > coalesce(v_available_accumulated, 0) then
      raise exception 'El retiro no puede superar el efectivo acumulado disponible en caja.';
    end if;
  end if;

  v_label := coalesce(
    nullif(trim(coalesce(v_profile.full_name, '')), ''),
    nullif(trim(coalesce(v_profile.email, '')), ''),
    'Caja'
  );

  insert into public.cash_withdrawals (
    business_date,
    amount,
    scope,
    note,
    created_by_user_id,
    created_by_label
  )
  values (
    v_business_date,
    p_amount,
    v_scope,
    nullif(trim(coalesce(p_note, '')), ''),
    v_user_id,
    v_label
  )
  returning * into v_withdrawal;

  return v_withdrawal;
end;
$$;

grant execute on function public.create_cash_withdrawal(numeric, text, text) to authenticated;

drop function if exists public.acknowledge_cash_closeout(uuid);

create or replace function public.acknowledge_cash_closeout(
  p_closeout_id uuid
)
returns public.cash_closeouts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_role public.pos_role;
  v_profile public.profiles%rowtype;
  v_closeout public.cash_closeouts%rowtype;
  v_label text;
begin
  if v_user_id is null then
    raise exception 'No authenticated user for closeout review.';
  end if;

  select * into v_profile
  from public.profiles
  where id = v_user_id;

  v_role := v_profile.role;

  if v_role <> 'jefa' then
    raise exception 'Solo jefa puede revisar alertas de caja.';
  end if;

  select *
  into v_closeout
  from public.cash_closeouts
  where id = p_closeout_id
  for update;

  if not found then
    raise exception 'El cierre de caja no existe.';
  end if;

  if coalesce(v_closeout.difference, 0) = 0 then
    raise exception 'Solo los cierres con discrepancia requieren revisión.';
  end if;

  v_label := coalesce(
    nullif(trim(coalesce(v_profile.full_name, '')), ''),
    nullif(trim(coalesce(v_profile.email, '')), ''),
    'Jefa'
  );

  update public.cash_closeouts
  set
    reviewed_by_user_id = v_user_id,
    reviewed_by_label = v_label,
    reviewed_at = timezone('utc', now())
  where id = p_closeout_id
  returning * into v_closeout;

  return v_closeout;
end;
$$;

grant execute on function public.acknowledge_cash_closeout(uuid) to authenticated;

drop function if exists public.sales_today_summary();

create or replace function public.sales_today_summary()
returns table (
  sales_count bigint,
  gross_sales numeric,
  discount_total numeric,
  net_revenue numeric,
  estimated_cost numeric,
  gross_profit numeric
)
language sql
security definer
set search_path = public
as $$
  select
    count(*) filter (where not is_cancelled) as sales_count,
    coalesce(sum(gross_total) filter (where not is_cancelled), 0) as gross_sales,
    coalesce(sum(discount_total) filter (where not is_cancelled), 0) as discount_total,
    coalesce(sum(net_total) filter (where not is_cancelled), 0) + (
      select coalesce(sum(amount), 0)
      from public.client_payments
      where created_at >= date_trunc('day', now() at time zone 'America/Bogota') at time zone 'America/Bogota'
        and created_at < (date_trunc('day', now() at time zone 'America/Bogota') + interval '1 day') at time zone 'America/Bogota'
    ) as net_revenue,
    coalesce(sum(estimated_cost) filter (where not is_cancelled), 0) as estimated_cost,
    coalesce(sum(gross_profit) filter (where not is_cancelled), 0) as gross_profit
  from public.sales
  where created_at >= date_trunc('day', now() at time zone 'America/Bogota') at time zone 'America/Bogota'
    and created_at < (date_trunc('day', now() at time zone 'America/Bogota') + interval '1 day') at time zone 'America/Bogota';
$$;

grant execute on function public.sales_today_summary() to authenticated;

with source_products (name, category, subcategory, price, cost, description, image, active, track_stock, low_stock_threshold) as (
  values
    ('Club Colombia', 'Bebidas', 'Alcohol', 6000, 0, 'Cerveza nacional en botella.', '🍺', true, true, 0),
    ('Aguila', 'Bebidas', 'Alcohol', 4000, 2500, 'Cerveza Aguila en botella.', '🍺', true, true, 0),
    ('Aguila Light', 'Bebidas', 'Alcohol', 4000, 2600, 'Cerveza Aguila Light en botella.', '🍺', true, true, 0),
    ('Pilsen', 'Bebidas', 'Alcohol', 4000, 2600, 'Cerveza Pilsen en botella.', '🍺', true, true, 0),
    ('Corona', 'Bebidas', 'Alcohol', 0, 0, 'Producto cargado desde la lista real; falta completar el precio de venta.', '🍺', true, true, 0),
    ('Coronita', 'Bebidas', 'Alcohol', 0, 0, 'Producto cargado desde la lista real; falta completar el precio de venta.', '🍺', true, true, 0),
    ('Agua', 'Bebidas', 'Frías', 2000, 0, 'Agua embotellada.', '💧', true, true, 0),
    ('Cocacola 400ml', 'Bebidas', 'Frías', 3500, 2500, 'Gaseosa Coca-Cola 400ml.', '🥤', true, true, 0),
    ('Cocacola mini', 'Bebidas', 'Frías', 2500, 1500, 'Gaseosa Coca-Cola mini.', '🥤', true, true, 0),
    ('Postobon Mini', 'Bebidas', 'Frías', 2500, 1142, 'Gaseosa Postobón mini.', '🥤', true, true, 0),
    ('Saviloe 320ml', 'Bebidas', 'Frías', 3500, 2030, 'Bebida Saviloe 320ml.', '🧃', true, true, 0),
    ('Hydralite 640ml', 'Bebidas', 'Frías', 5500, 3400, 'Bebida Hydralite 640ml.', '🧃', true, true, 0),
    ('Bretaña', 'Bebidas', 'Frías', 3000, 1917, 'Bebida Bretaña.', '🥤', true, true, 0),
    ('Malta', 'Bebidas', 'Frías', 3500, 2070, 'Bebida malta.', '🥤', true, true, 0),
    ('Poni Malta', 'Bebidas', 'Frías', 2000, 1100, 'Poni Malta individual.', '🥤', true, true, 0),
    ('Vaso Michelada', 'Bebidas', 'Alcohol', 2000, 0, 'Preparación de michelada en vaso.', '🍺', true, true, 0),
    ('Tutti Frutti', 'Bebidas', 'Frías', 3000, 1666, 'Bebida Tutti Frutti.', '🧃', true, true, 0),
    ('Gaseosa Postobon', 'Bebidas', 'Frías', 3500, 1666, 'Gaseosa Postobón.', '🥤', true, true, 0),
    ('Almuerzo Completo', 'Almuerzos', null, 15000, 0, 'Servicio completo del almuerzo del día.', '🍽️', true, false, null),
    ('Almuerzo Economico', 'Almuerzos', null, 12000, 0, 'Opción económica del almuerzo del día.', '🥘', true, false, null),
    ('Sopa', 'Almuerzos', null, 10000, 0, 'Sopa servida caliente.', '🍲', true, false, null),
    ('Chuzos de Pollo', 'Comidas', null, 15000, 7000, 'Chuzos de pollo listos para servir.', '🍢', true, true, 0),
    ('Salchipapa Sencilla', 'Comidas', null, 5000, 0, 'Salchipapa sencilla.', '🍟', true, false, null),
    ('Salchipapa Chorizo', 'Comidas', null, 8000, 0, 'Salchipapa con chorizo.', '🍟', true, false, null),
    ('Butifarra', 'Comidas', null, 1000, 338, 'Butifarra individual.', '🥩', true, true, 0),
    ('Panceroti', 'Comidas', null, 5000, 0, 'Panceroti listo para servir.', '🥟', true, true, 0),
    ('Palito de queso', 'Comidas', null, 5000, 0, 'Palito de queso.', '🧀', true, true, 0),
    ('Porción Torta Red Velvet', 'Comidas', null, 0, 0, 'Producto cargado desde la lista real; falta completar el precio de venta.', '🍰', true, true, 0),
    ('Porción Torta Zanahoria', 'Comidas', null, 0, 0, 'Producto cargado desde la lista real; falta completar el precio de venta.', '🍰', true, true, 0),
    ('Litro Aguardiente Verde', 'Bebidas', 'Alcohol', 0, 0, 'Producto cargado desde la lista real; falta completar el precio de venta.', '🥃', true, true, 0),
    ('Botella Aguardiente', 'Bebidas', 'Alcohol', 0, 0, 'Producto cargado desde la lista real; falta completar el precio de venta.', '🥃', true, true, 0),
    ('Bailys 700ml', 'Bebidas', 'Alcohol', 0, 0, 'Producto cargado desde la lista real; falta completar el precio de venta.', '🥃', true, true, 0),
    ('Jose Cuervo 375ml', 'Bebidas', 'Alcohol', 0, 0, 'Producto cargado desde la lista real; falta completar el precio de venta.', '🥃', true, true, 0),
    ('1/2 Aguardiente Azul', 'Bebidas', 'Alcohol', 0, 0, 'Producto cargado desde la lista real; falta completar el precio de venta.', '🥃', true, true, 0),
    ('1/2 Aguardiente Rojo', 'Bebidas', 'Alcohol', 0, 0, 'Producto cargado desde la lista real; falta completar el precio de venta.', '🥃', true, true, 0),
    ('1/2 Aguardiente Verde', 'Bebidas', 'Alcohol', 0, 0, 'Producto cargado desde la lista real; falta completar el precio de venta.', '🥃', true, true, 0),
    ('Garrafa Aguardiente Azul', 'Bebidas', 'Alcohol', 0, 0, 'Producto cargado desde la lista real; falta completar el precio de venta.', '🥃', true, true, 0),
    ('Garrafa Aguardiente Roja', 'Bebidas', 'Alcohol', 0, 0, 'Producto cargado desde la lista real; falta completar el precio de venta.', '🥃', true, true, 0),
    ('Garrafa Aguardiente Verde', 'Bebidas', 'Alcohol', 0, 0, 'Producto cargado desde la lista real; falta completar el precio de venta.', '🥃', true, true, 0),
    ('1/2 Ron Caldas', 'Bebidas', 'Alcohol', 0, 0, 'Producto cargado desde la lista real; falta completar el precio de venta.', '🥃', true, true, 0),
    ('Garrafa Ron Caldas', 'Bebidas', 'Alcohol', 0, 0, 'Producto cargado desde la lista real; falta completar el precio de venta.', '🥃', true, true, 0),
    ('Botella Ron Caldas', 'Bebidas', 'Alcohol', 0, 0, 'Producto cargado desde la lista real; falta completar el precio de venta.', '🥃', true, true, 0),
    ('Bucanas', 'Bebidas', 'Alcohol', 0, 0, 'Producto cargado desde la lista real; falta completar el precio de venta.', '🥃', true, true, 0),
    ('1/4 Aguardiente verde', 'Bebidas', 'Alcohol', 20000, 14700, 'Cuarto de aguardiente verde.', '🥃', true, true, 0),
    ('Buchanas 375ml', 'Bebidas', 'Alcohol', 110000, 86800, 'Whisky Buchanas 375ml.', '🥃', true, true, 0),
    ('Old Par 500ml', 'Bebidas', 'Alcohol', 130000, 94000, 'Whisky Old Par 500ml.', '🥃', true, true, 0),
    ('Shot Aguardiente', 'Bebidas', 'Alcohol', 0, 0, 'Producto cargado desde la lista real; falta completar el precio de venta.', '🥃', true, false, null),
    ('Shot Ron', 'Bebidas', 'Alcohol', 0, 0, 'Producto cargado desde la lista real; falta completar el precio de venta.', '🥃', true, false, null),
    ('Shot Whisky', 'Bebidas', 'Alcohol', 0, 0, 'Producto cargado desde la lista real; falta completar el precio de venta.', '🥃', true, false, null),
    ('Tinto', 'Bebidas', 'Calientes', 1200, 0, 'Tinto servido al momento.', '☕', true, false, null),
    ('Aromatica', 'Bebidas', 'Calientes', 1000, 0, 'Aromática caliente.', '🍵', true, true, 0),
    ('Aromatica Leche', 'Bebidas', 'Calientes', 2000, 0, 'Aromática con leche.', '🍵', true, true, 0),
    ('Café con leche', 'Bebidas', 'Calientes', 2300, 0, 'Café con leche caliente.', '☕', true, false, null),
    ('Milo', 'Bebidas', 'Calientes', 0, 0, 'Producto cargado desde la lista real; falta completar el precio de venta.', '🥛', true, false, null)
),
updated_products as (
  update public.products as product
  set
    category = source.category,
    subcategory = source.subcategory,
    price = source.price,
    cost = source.cost,
    description = source.description,
    image = source.image,
    active = source.active,
    track_stock = source.track_stock,
    stock_quantity = case
      when source.track_stock then coalesce(product.stock_quantity, 0)
      else null
    end,
    low_stock_threshold = case
      when source.track_stock then coalesce(product.low_stock_threshold, source.low_stock_threshold)
      else null
    end,
    archived_at = null,
    updated_at = timezone('utc', now())
  from source_products as source
  where lower(product.name) = lower(source.name)
  returning product.id
),
inserted_products as (
  insert into public.products (
    name,
    category,
    subcategory,
    price,
    cost,
    description,
    image,
    active,
    track_stock,
    stock_quantity,
    low_stock_threshold,
    archived_at
  )
  select
    source.name,
    source.category,
    source.subcategory,
    source.price,
    source.cost,
    source.description,
    source.image,
    source.active,
    source.track_stock,
    case when source.track_stock then 0 else null end,
    source.low_stock_threshold,
    null
  from source_products as source
  where not exists (
    select 1
    from public.products as product
    where lower(product.name) = lower(source.name)
  )
  returning id
)
update public.products
set
  active = false,
  archived_at = coalesce(archived_at, timezone('utc', now())),
  updated_at = timezone('utc', now())
where archived_at is null
  and lower(name) not in (
    select lower(name)
    from source_products
  );

insert into public.clients (full_name, active, pricing_type, notes)
values
  ('Carmelita', true, 'familia', 'Descuento familiar del 100%.'),
  ('Bernardo', true, 'familia', 'Descuento familiar del 100%.'),
  ('Pacho', true, 'fiado', 'Consumo a cuenta pendiente.'),
  ('Ferreteria', true, 'fiado', 'Cuenta separada para compras a credito.')
on conflict do nothing;
