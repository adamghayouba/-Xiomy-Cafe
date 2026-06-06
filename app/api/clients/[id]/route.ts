import { NextResponse } from "next/server";
import { requireApiContext } from "@/lib/api-context";
import { isClientPricingType, mapClientRecord } from "@/lib/pos-domain";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const context = await requireApiContext();

  if (!context.ok) {
    return context.response;
  }

  if (!context.permissions["products.admin"]) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const fullName = String(body.fullName ?? "").trim();
  const pricingType = String(body.pricingType ?? "normal");
  const notes = String(body.notes ?? "").trim();
  const active = body.active !== false;

  if (!id || !fullName || !isClientPricingType(pricingType)) {
    return NextResponse.json({ error: "Datos del cliente inválidos." }, { status: 400 });
  }

  const { data, error } = await context.supabase
    .from("clients")
    .update({
      full_name: fullName,
      pricing_type: pricingType,
      notes: notes || null,
      active
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "No fue posible actualizar el cliente." },
      { status: 400 }
    );
  }

  return NextResponse.json({
    client: mapClientRecord(data as Record<string, unknown>)
  });
}
