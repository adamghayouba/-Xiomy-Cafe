import { NextResponse } from "next/server";
import { requireApiContext } from "@/lib/api-context";
import { isClientPricingType, mapClientRecord } from "@/lib/pos-domain";

export async function POST(request: Request) {
  const context = await requireApiContext();

  if (!context.ok) {
    return context.response;
  }

  if (!context.permissions["products.admin"]) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const body = await request.json();
  const fullName = String(body.fullName ?? "").trim();
  const pricingType = String(body.pricingType ?? "normal");
  const notes = String(body.notes ?? "").trim();
  const active = body.active !== false;

  if (!fullName || !isClientPricingType(pricingType)) {
    return NextResponse.json({ error: "Datos del cliente inválidos." }, { status: 400 });
  }

  const { data, error } = await context.supabase
    .from("clients")
    .insert({
      full_name: fullName,
      pricing_type: pricingType,
      notes: notes || null,
      active
    })
    .select("*")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "No fue posible crear el cliente." },
      { status: 400 }
    );
  }

  return NextResponse.json({
    client: mapClientRecord(data as Record<string, unknown>)
  });
}
