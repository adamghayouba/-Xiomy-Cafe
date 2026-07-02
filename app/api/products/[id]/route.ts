import { NextResponse } from "next/server";
import {
  isBeverageSubcategory,
  isTopLevelCategory
} from "@/lib/pos-data";
import { requireApiContext } from "@/lib/api-context";
import { mapProductRecord } from "@/lib/pos-domain";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const context = await requireApiContext();

  if (!context.ok) {
    return context.response;
  }

  if (!context.permissions["products.edit"]) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const name = String(body.name ?? "").trim();
  const category = String(body.category ?? "");
  const subcategory = String(body.subcategory ?? "");
  const price = Number(body.price ?? 0);
  const cost =
    body.cost === "" || body.cost === null || typeof body.cost === "undefined"
      ? null
      : Number(body.cost);
  const image = String(body.image ?? "").trim();
  const active = body.active !== false;
  const trackStock = body.trackStock === true;
  const lowStockThreshold =
    body.lowStockThreshold === "" ||
    body.lowStockThreshold === null ||
    typeof body.lowStockThreshold === "undefined"
      ? null
      : Number(body.lowStockThreshold);

  if (!id || !name || !isTopLevelCategory(category) || Number.isNaN(price) || price < 0) {
    return NextResponse.json({ error: "Datos del producto inválidos." }, { status: 400 });
  }

  if (cost !== null && (Number.isNaN(cost) || cost < 0)) {
    return NextResponse.json({ error: "El costo no es válido." }, { status: 400 });
  }

  if (trackStock) {
    if (
      lowStockThreshold !== null &&
      (Number.isNaN(lowStockThreshold) || lowStockThreshold < 0)
    ) {
      return NextResponse.json({ error: "El stock mínimo no es válido." }, { status: 400 });
    }
  }

  if (category === "Bebidas" && subcategory && !isBeverageSubcategory(subcategory)) {
    return NextResponse.json({ error: "Subcategoría inválida." }, { status: 400 });
  }

  const { data: existingProduct, error: existingProductError } = await context.supabase
    .from("products")
    .select("stock_quantity, track_stock")
    .eq("id", id)
    .is("archived_at", null)
    .single();

  if (existingProductError || !existingProduct) {
    return NextResponse.json(
      { error: existingProductError?.message ?? "No fue posible cargar el producto actual." },
      { status: 400 }
    );
  }

  const nextStockQuantity = trackStock
    ? existingProduct.track_stock
      ? existingProduct.stock_quantity
      : coalesceToZero(existingProduct.stock_quantity)
    : null;

  const { data, error } = await context.supabase
    .from("products")
    .update({
      name,
      category,
      subcategory: category === "Bebidas" ? subcategory || null : null,
      price,
      cost,
      image,
      active,
      track_stock: trackStock,
      stock_quantity: nextStockQuantity,
      low_stock_threshold: trackStock ? lowStockThreshold : null
    })
    .eq("id", id)
    .is("archived_at", null)
    .select("*")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "No fue posible actualizar el producto." },
      { status: 400 }
    );
  }

  return NextResponse.json({
    product: mapProductRecord(data as Record<string, unknown>)
  });
}

function coalesceToZero(value: unknown) {
  const nextValue = Number(value ?? 0);

  return Number.isFinite(nextValue) && nextValue >= 0 ? nextValue : 0;
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const context = await requireApiContext();

  if (!context.ok) {
    return context.response;
  }

  if (!context.permissions["products.delete"]) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const { id } = await params;

  if (!id) {
    return NextResponse.json({ error: "Producto inválido." }, { status: 400 });
  }

  const { data, error } = await context.supabase
    .from("products")
    .update({
      active: false,
      archived_at: new Date().toISOString()
    })
    .eq("id", id)
    .is("archived_at", null)
    .select("id")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "No fue posible eliminar el producto." },
      { status: 400 }
    );
  }

  return NextResponse.json({ success: true });
}
