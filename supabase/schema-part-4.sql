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
  cancelled_sales numeric,
  expected_cash numeric
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
  )
  select
    effective_scope.business_date,
    coalesce(p_starting_cash, 0)::numeric(12, 2) as starting_cash,
    sales_totals.cash_sales,
    sales_totals.transfer_sales,
    sales_totals.fiado_generated,
    sales_totals.family_consumption,
    payment_totals.repayments_received,
    sales_totals.cancelled_sales,
    (coalesce(p_starting_cash, 0) + sales_totals.cash_sales + payment_totals.repayments_cash)::numeric(12, 2) as expected_cash
  from effective_scope, sales_totals, payment_totals;
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

