import { NextResponse } from "next/server";
import { requireApiContext } from "@/lib/api-context";
import {
  mapSaleCancellationRequestRecord,
  mapSaleRecord
} from "@/lib/pos-domain";

const requestSelect =
  "id, sale_id, requested_by_user_id, requested_by_label, requested_at, reason, status, approved_by_user_id, approved_by_label, approved_at, rejected_at, resolution_note, sale:sales(id, created_at, gross_total, net_total)";

const saleSelect =
  "id, created_at, payment_method, settlement_type, gross_total, discount_total, net_total, estimated_cost, gross_profit, items_count, sale_status, is_cancelled, cancellation_reason, cancellation_requested_at, cancellation_approved_at, cancellation_request_status, client:clients(full_name, pricing_type)";

export async function GET() {
  const context = await requireApiContext();

  if (!context.ok) {
    return context.response;
  }

  if (!context.permissions["sales.cancel.approve"]) {
    return NextResponse.json({ requests: [] });
  }

  const { data, error } = await context.supabase
    .from("sale_cancellation_requests")
    .select(requestSelect)
    .eq("status", "pending")
    .order("requested_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: error.message ?? "No fue posible cargar las anulaciones pendientes." },
      { status: 400 }
    );
  }

  return NextResponse.json({
    requests: (data ?? []).map((row) =>
      mapSaleCancellationRequestRecord(row as Record<string, unknown>)
    )
  });
}

export async function POST(request: Request) {
  const context = await requireApiContext();

  if (!context.ok) {
    return context.response;
  }

  if (!context.permissions["sales.cancel.request"]) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const body = await request.json();
  const saleId = String(body.saleId ?? "").trim();
  const reason = body.reason ? String(body.reason) : null;

  if (!saleId) {
    return NextResponse.json({ error: "Debes seleccionar una venta." }, { status: 400 });
  }

  const { data: requestData, error: requestError } = await context.supabase.rpc(
    "request_sale_cancellation",
    {
      p_sale_id: saleId,
      p_reason: reason
    }
  );

  if (requestError) {
    return NextResponse.json(
      { error: requestError.message ?? "No fue posible solicitar la anulación." },
      { status: 400 }
    );
  }

  const [requestRowResult, saleRowResult] = await Promise.all([
    context.supabase
      .from("sale_cancellation_requests")
      .select(requestSelect)
      .eq("id", Array.isArray(requestData) ? requestData[0]?.id : requestData?.id)
      .single(),
    context.supabase.from("sales").select(saleSelect).eq("id", saleId).single()
  ]);

  if (requestRowResult.error) {
    return NextResponse.json(
      { error: requestRowResult.error.message ?? "No fue posible cargar la solicitud creada." },
      { status: 400 }
    );
  }

  if (saleRowResult.error) {
    return NextResponse.json(
      { error: saleRowResult.error.message ?? "No fue posible actualizar la venta." },
      { status: 400 }
    );
  }

  return NextResponse.json({
    request: mapSaleCancellationRequestRecord(
      requestRowResult.data as Record<string, unknown>
    ),
    sale: mapSaleRecord(saleRowResult.data as Record<string, unknown>)
  });
}
