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
