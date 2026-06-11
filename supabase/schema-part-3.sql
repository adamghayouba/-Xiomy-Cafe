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

