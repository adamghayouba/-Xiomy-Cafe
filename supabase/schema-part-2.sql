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

drop function if exists public.create_sale(public.payment_method, jsonb);
drop function if exists public.create_sale(public.payment_method, jsonb, uuid);
drop function if exists public.create_sale(public.payment_method, public.sale_settlement_type, jsonb, uuid);

