import { NextResponse } from "next/server";
import { isPaymentMethod } from "@/lib/pos-data";
import { isSettlementType } from "@/lib/pos-domain";
import { requireApiContext } from "@/lib/api-context";
import {
  mapClientTransactionRecord,
  mapSaleRecord,
  mapSummaryRecord
} from "@/lib/pos-domain";

const salesSelect =
  "id, client_id, created_at, payment_method, settlement_type, gross_total, discount_total, net_total, estimated_cost, gross_profit, items_count, sale_status, is_cancelled, cancellation_reason, cancellation_requested_at, cancellation_approved_at, cancellation_request_status, client:clients(full_name, pricing_type), sale_items(id, quantity, unit_price, line_total, product:products(name))";

function getCurrentBogotaWindow() {
  const formatter = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  });

  const parts = Object.fromEntries(
    formatter
      .formatToParts(new Date())
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  ) as Record<string, string>;

  const year = Number(parts.year);
  const month = Number(parts.month);
  const day = Number(parts.day);
  const hour = Number(parts.hour);
  const minute = Number(parts.minute);
  const second = Number(parts.second);

  return {
    businessDate: `${parts.year}-${parts.month}-${parts.day}`,
    startIso: new Date(Date.UTC(year, month - 1, day, 5, 0, 0, 0)).toISOString(),
    endIso: new Date(Date.UTC(year, month - 1, day + 1, 5, 0, 0, 0)).toISOString(),
    nowIso: new Date(Date.UTC(year, month - 1, day, hour + 5, minute, second, 0)).toISOString()
  };
}

export async function GET() {
  const context = await requireApiContext();

  if (!context.ok) {
    return context.response;
  }

  if (!context.permissions["sales.summary"]) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const window = getCurrentBogotaWindow();

  const { data: lastCloseout, error: closeoutError } = await context.supabase
    .from("cash_closeouts")
    .select("created_at")
    .eq("cashier_user_id", context.profile.id)
    .eq("business_date", window.businessDate)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (closeoutError) {
    return NextResponse.json(
      { error: closeoutError.message ?? "No fue posible cargar el último cierre de caja." },
      { status: 400 }
    );
  }

  const rangeStart = lastCloseout?.created_at ? String(lastCloseout.created_at) : window.startIso;

  const { data, error } = await context.supabase
    .from("sales")
    .select(salesSelect)
    .eq("cashier_user_id", context.profile.id)
    .gte("created_at", rangeStart)
    .lt("created_at", window.endIso)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json(
      { error: error.message ?? "No fue posible cargar la historia diaria de ventas." },
      { status: 400 }
    );
  }

  return NextResponse.json({
    sales: (data ?? []).map((row) =>
      mapClientTransactionRecord(row as Record<string, unknown>)
    ),
    rangeStart,
    rangeEnd: window.nowIso,
    businessDate: window.businessDate
  });
}

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
