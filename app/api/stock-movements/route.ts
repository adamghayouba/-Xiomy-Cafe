import { NextResponse } from "next/server";
import { requireApiContext } from "@/lib/api-context";
import { mapProductRecord, mapStockMovementRecord } from "@/lib/pos-domain";

const stockMovementSelect =
  "id, product_id, movement_type, quantity, reason, note, created_by_label, created_at";

export async function GET(request: Request) {
  const context = await requireApiContext();

  if (!context.ok) {
    return context.response;
  }

  if (!context.permissions["products.admin"]) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const url = new URL(request.url);
  const productId = String(url.searchParams.get("productId") ?? "").trim();

  let query = context.supabase
    .from("stock_movements")
    .select(stockMovementSelect)
    .order("created_at", { ascending: false })
    .limit(250);

  if (productId) {
    query = query.eq("product_id", productId);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json(
      { error: error.message ?? "No fue posible cargar el historial de movimientos." },
      { status: 400 }
    );
  }

  return NextResponse.json({
    movements: (data ?? []).map((row) =>
      mapStockMovementRecord(row as Record<string, unknown>)
    )
  });
}

export async function POST(request: Request) {
  const context = await requireApiContext();

  if (!context.ok) {
    return context.response;
  }

  if (!context.permissions["products.edit"]) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const body = await request.json();
  const actionType = String(body.actionType ?? "restock").trim();
  const productId = String(body.productId ?? "").trim();
  const quantity = Number(body.quantity ?? NaN);
  const reason = body.reason ? String(body.reason).trim() : null;
  const note = body.note ? String(body.note) : null;

  if (!productId || !Number.isFinite(quantity) || quantity <= 0) {
    return NextResponse.json(
      { error: "Debes seleccionar un producto y una cantidad válida." },
      { status: 400 }
    );
  }

  if (actionType !== "restock" && actionType !== "adjustment") {
    return NextResponse.json({ error: "Acción de stock no válida." }, { status: 400 });
  }

  if (actionType === "adjustment" && !reason) {
    return NextResponse.json(
      { error: "Debes seleccionar un motivo para el ajuste." },
      { status: 400 }
    );
  }

  const rpcName =
    actionType === "adjustment" ? "record_stock_adjustment" : "record_stock_restock";
  const rpcParams =
    actionType === "adjustment"
      ? {
          p_product_id: productId,
          p_quantity: Math.trunc(quantity),
          p_reason: reason,
          p_note: note
        }
      : {
          p_product_id: productId,
          p_quantity: Math.trunc(quantity),
          p_note: note
        };

  const { data: movementData, error: movementError } = await context.supabase.rpc(
    rpcName,
    rpcParams
  );

  if (movementError) {
    return NextResponse.json(
      {
        error:
          movementError.message ??
          (actionType === "adjustment"
            ? "No fue posible registrar el ajuste de stock."
            : "No fue posible registrar el ingreso de stock.")
      },
      { status: 400 }
    );
  }

  const movementId = Array.isArray(movementData) ? movementData[0]?.id : movementData?.id;

  const [movementResult, productResult] = await Promise.all([
    context.supabase
      .from("stock_movements")
      .select(stockMovementSelect)
      .eq("id", movementId)
      .single(),
    context.supabase
      .from("products")
      .select("*")
      .eq("id", productId)
      .is("archived_at", null)
      .single()
  ]);

  if (movementResult.error) {
    return NextResponse.json(
      {
        error:
          movementResult.error.message ??
          (actionType === "adjustment"
            ? "No fue posible cargar el ajuste de stock registrado."
            : "No fue posible cargar el ingreso de stock registrado.")
      },
      { status: 400 }
    );
  }

  if (productResult.error || !productResult.data) {
    return NextResponse.json(
      { error: productResult.error?.message ?? "No fue posible cargar el producto actualizado." },
      { status: 400 }
    );
  }

  return NextResponse.json({
    movement: mapStockMovementRecord(movementResult.data as Record<string, unknown>),
    product: mapProductRecord(productResult.data as Record<string, unknown>)
  });
}
