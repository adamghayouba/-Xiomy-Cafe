import { NextResponse } from "next/server";
import {
  isBeverageSubcategory,
  isTopLevelCategory
} from "@/lib/pos-data";
import { requireApiContext } from "@/lib/api-context";
import { mapProductRecord } from "@/lib/pos-domain";

export async function POST(request: Request) {
  const context = await requireApiContext();

  if (!context.ok) {
    return context.response;
  }

  if (!context.permissions["products.create"]) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

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
  const stockQuantity =
    body.stockQuantity === "" || body.stockQuantity === null || typeof body.stockQuantity === "undefined"
      ? null
      : Number(body.stockQuantity);
  const lowStockThreshold =
    body.lowStockThreshold === "" ||
    body.lowStockThreshold === null ||
    typeof body.lowStockThreshold === "undefined"
      ? null
      : Number(body.lowStockThreshold);

  if (!name || !isTopLevelCategory(category) || Number.isNaN(price) || price < 0) {
    return NextResponse.json({ error: "Datos del producto inválidos." }, { status: 400 });
  }

  if (cost !== null && (Number.isNaN(cost) || cost < 0)) {
    return NextResponse.json({ error: "El costo no es válido." }, { status: 400 });
  }

  if (trackStock) {
    if (stockQuantity === null || Number.isNaN(stockQuantity) || stockQuantity < 0) {
      return NextResponse.json({ error: "La cantidad actual de stock no es válida." }, { status: 400 });
    }

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

  const { data, error } = await context.supabase
    .from("products")
    .insert({
      name,
      category,
      subcategory: category === "Bebidas" ? subcategory || null : null,
      price,
      cost,
      image,
      active,
      description: "",
      track_stock: trackStock,
      stock_quantity: trackStock ? stockQuantity : null,
      low_stock_threshold: trackStock ? lowStockThreshold : null
    })
    .select("*")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "No fue posible crear el producto." },
      { status: 400 }
    );
  }

  return NextResponse.json({
    product: mapProductRecord(data as Record<string, unknown>)
  });
}
