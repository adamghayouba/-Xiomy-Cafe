import { NextResponse } from "next/server";
import {
  buildSalesReport,
  mapClientPaymentRecord,
  mapClientTransactionRecord
} from "@/lib/pos-domain";
import type { SalesReportPeriod } from "@/lib/pos-types";
import { requireApiContext } from "@/lib/api-context";
import { getBogotaCustomRange, getBogotaSalesRange } from "@/lib/pos-utils";

function isSalesReportPeriod(value: string): value is SalesReportPeriod {
  return value === "day" || value === "week" || value === "month" || value === "year" || value === "custom";
}

const salesSelect =
  "id, client_id, created_at, payment_method, settlement_type, gross_total, discount_total, net_total, estimated_cost, gross_profit, items_count, sale_status, is_cancelled, cancellation_reason, cancellation_requested_at, cancellation_approved_at, cancellation_request_status, client:clients(full_name, pricing_type), sale_items(id, quantity, unit_price, line_total, product:products(name))";

export async function GET(request: Request) {
  const context = await requireApiContext();

  if (!context.ok) {
    return context.response;
  }

  if (!context.permissions["finance.viewAdvanced"]) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const url = new URL(request.url);
  const periodValue = String(url.searchParams.get("period") ?? "day");
  const startDate = url.searchParams.get("startDate");
  const endDate = url.searchParams.get("endDate");

  if (!isSalesReportPeriod(periodValue)) {
    return NextResponse.json({ error: "Periodo inválido." }, { status: 400 });
  }

  if (periodValue === "custom" && (!startDate || !endDate)) {
    return NextResponse.json(
      { error: "Debes enviar startDate y endDate para el rango personalizado." },
      { status: 400 }
    );
  }

  const range =
    periodValue === "custom" && startDate && endDate
      ? getBogotaCustomRange(startDate, endDate)
      : getBogotaSalesRange(periodValue === "custom" ? "day" : periodValue);

  const [salesResult, paymentsResult, allFiadoSalesResult, allFiadoPaymentsResult] =
    await Promise.all([
      context.supabase
        .from("sales")
        .select(salesSelect)
        .gte("created_at", range.startIso)
        .lt("created_at", range.endIso)
        .order("created_at", { ascending: false }),
      context.supabase
        .from("client_payments")
        .select("id, client_id, amount, payment_method, paid_by_name, notes, created_at")
        .gte("created_at", range.startIso)
        .lt("created_at", range.endIso)
        .order("created_at", { ascending: false }),
      context.supabase
        .from("sales")
        .select(salesSelect)
        .eq("sale_status", "pending")
        .order("created_at", { ascending: false }),
      context.supabase
        .from("client_payments")
        .select("id, client_id, amount, payment_method, paid_by_name, notes, created_at")
        .order("created_at", { ascending: false })
    ]);

  if (salesResult.error) {
    return NextResponse.json(
      { error: salesResult.error.message ?? "No fue posible cargar ventas." },
      { status: 400 }
    );
  }

  if (paymentsResult.error) {
    return NextResponse.json(
      { error: paymentsResult.error.message ?? "No fue posible cargar abonos." },
      { status: 400 }
    );
  }

  if (allFiadoSalesResult.error) {
    return NextResponse.json(
      { error: allFiadoSalesResult.error.message ?? "No fue posible cargar cuentas pendientes." },
      { status: 400 }
    );
  }

  if (allFiadoPaymentsResult.error) {
    return NextResponse.json(
      { error: allFiadoPaymentsResult.error.message ?? "No fue posible cargar pagos de cuentas pendientes." },
      { status: 400 }
    );
  }

  const report = buildSalesReport({
    sales: (salesResult.data ?? []).map((row) =>
      mapClientTransactionRecord(row as Record<string, unknown>)
    ),
    payments: (paymentsResult.data ?? []).map((row) =>
      mapClientPaymentRecord(row as Record<string, unknown>)
    ),
    allFiadoSales: (allFiadoSalesResult.data ?? []).map((row) =>
      mapClientTransactionRecord(row as Record<string, unknown>)
    ),
    allFiadoPayments: (allFiadoPaymentsResult.data ?? []).map((row) =>
      mapClientPaymentRecord(row as Record<string, unknown>)
    ),
    period: periodValue,
    startDate,
    endDate
  });

  return NextResponse.json(report);
}
