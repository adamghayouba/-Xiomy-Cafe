import { NextResponse } from "next/server";
import { requireApiContext } from "@/lib/api-context";
import {
  mapSaleCancellationRequestRecord,
  mapSaleRecord,
  mapSummaryRecord
} from "@/lib/pos-domain";

const requestSelect =
  "id, sale_id, requested_by_user_id, requested_by_label, requested_at, reason, status, approved_by_user_id, approved_by_label, approved_at, rejected_at, resolution_note, sale:sales(id, created_at, gross_total, net_total)";

const saleSelect =
  "id, created_at, payment_method, settlement_type, gross_total, discount_total, net_total, estimated_cost, gross_profit, items_count, sale_status, is_cancelled, cancellation_reason, cancellation_requested_at, cancellation_approved_at, cancellation_request_status, client:clients(full_name, pricing_type)";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const context = await requireApiContext();

  if (!context.ok) {
    return context.response;
  }

  if (!context.permissions["sales.cancel.approve"]) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const { id } = await params;
  const requestId = String(id ?? "").trim();
  const body = await request.json();
  const action = String(body.action ?? "").trim();
  const resolutionNote = body.resolutionNote ? String(body.resolutionNote) : null;

  if (!requestId || (action !== "approve" && action !== "reject")) {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  }

  const { data: resolvedData, error: resolvedError } = await context.supabase.rpc(
    "resolve_sale_cancellation_request",
    {
      p_request_id: requestId,
      p_approve: action === "approve",
      p_resolution_note: resolutionNote
    }
  );

  if (resolvedError) {
    return NextResponse.json(
      { error: resolvedError.message ?? "No fue posible resolver la anulación." },
      { status: 400 }
    );
  }

  const requestRow = Array.isArray(resolvedData) ? resolvedData[0] : resolvedData;
  const saleId = String(requestRow?.sale_id ?? "");

  const [requestResult, saleResult, summaryResult] = await Promise.all([
    context.supabase
      .from("sale_cancellation_requests")
      .select(requestSelect)
      .eq("id", requestId)
      .single(),
    saleId
      ? context.supabase.from("sales").select(saleSelect).eq("id", saleId).single()
      : Promise.resolve({ data: null, error: null }),
    context.supabase.rpc("sales_today_summary")
  ]);

  if (requestResult.error) {
    return NextResponse.json(
      { error: requestResult.error.message ?? "No fue posible cargar la solicitud." },
      { status: 400 }
    );
  }

  if (saleResult.error) {
    return NextResponse.json(
      { error: saleResult.error.message ?? "No fue posible cargar la venta actualizada." },
      { status: 400 }
    );
  }

  if (summaryResult.error) {
    return NextResponse.json(
      { error: summaryResult.error.message ?? "No fue posible recalcular el resumen diario." },
      { status: 400 }
    );
  }

  return NextResponse.json({
    request: mapSaleCancellationRequestRecord(requestResult.data as Record<string, unknown>),
    sale: saleResult.data ? mapSaleRecord(saleResult.data as Record<string, unknown>) : null,
    dailySummary: mapSummaryRecord(
      Array.isArray(summaryResult.data) ? summaryResult.data[0] : summaryResult.data
    )
  });
}
