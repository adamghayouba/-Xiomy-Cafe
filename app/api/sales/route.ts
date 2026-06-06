import { NextResponse } from "next/server";
import { isPaymentMethod } from "@/lib/pos-data";
import { isSettlementType } from "@/lib/pos-domain";
import { requireApiContext } from "@/lib/api-context";
import { mapSaleRecord, mapSummaryRecord } from "@/lib/pos-domain";

export async function POST(request: Request) {
  const context = await requireApiContext();

  if (!context.ok) {
    return context.response;
  }

  if (!context.permissions["sales.complete"]) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const body = await request.json();
  const paymentMethod = String(body.paymentMethod ?? "");
  const settlementType = String(body.settlementType ?? "pago_normal");
  const clientId = body.clientId ? String(body.clientId) : null;
  const items = Array.isArray(body.items) ? body.items : [];

  if (
    (paymentMethod && !isPaymentMethod(paymentMethod)) ||
    !isSettlementType(settlementType) ||
    !items.length
  ) {
    return NextResponse.json({ error: "La venta no es válida." }, { status: 400 });
  }

  const normalizedItems = items
    .map((item: { productId?: unknown; quantity?: unknown }) => ({
      product_id: String(item.productId ?? ""),
      quantity: Number(item.quantity ?? 0)
    }))
    .filter((item: { product_id: string; quantity: number }) => item.product_id && item.quantity > 0);

  if (!normalizedItems.length) {
    return NextResponse.json({ error: "No hay productos válidos en la venta." }, { status: 400 });
  }

  const { data: saleData, error: saleError } = await context.supabase.rpc("create_sale", {
    p_payment_method: paymentMethod || null,
    p_settlement_type: settlementType,
    p_items: normalizedItems,
    p_client_id: clientId
  });

  if (saleError) {
    return NextResponse.json(
      { error: saleError.message ?? "No fue posible registrar la venta." },
      { status: 400 }
    );
  }

  const saleRecord = Array.isArray(saleData) ? saleData[0] : saleData;
  const { data: summaryRows, error: summaryError } = await context.supabase.rpc("sales_today_summary");

  if (summaryError) {
    return NextResponse.json(
      { error: summaryError.message ?? "No fue posible actualizar el resumen diario." },
      { status: 400 }
    );
  }

  return NextResponse.json({
    sale: saleRecord ? mapSaleRecord(saleRecord as Record<string, unknown>) : null,
    dailySummary: mapSummaryRecord(Array.isArray(summaryRows) ? summaryRows[0] : summaryRows)
  });
}
