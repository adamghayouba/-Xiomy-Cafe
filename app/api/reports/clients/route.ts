import { NextResponse } from "next/server";
import {
  buildClientUsageReport,
  mapClientPaymentRecord,
  mapClientRecord,
  mapClientTransactionRecord
} from "@/lib/pos-domain";
import type { ClientReportPeriod } from "@/lib/pos-types";
import { requireApiContext } from "@/lib/api-context";
import { getBogotaCustomRange, getBogotaPeriodRange } from "@/lib/pos-utils";

function isClientReportPeriod(value: string): value is ClientReportPeriod {
  return value === "today" || value === "week" || value === "month" || value === "custom";
}

export async function GET(request: Request) {
  const context = await requireApiContext();

  if (!context.ok) {
    return context.response;
  }

  if (!context.permissions["finance.viewAdvanced"]) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const url = new URL(request.url);
  const periodValue = String(url.searchParams.get("period") ?? "today");
  const selectedClientId = url.searchParams.get("clientId");
  const startDate = url.searchParams.get("startDate");
  const endDate = url.searchParams.get("endDate");

  if (!isClientReportPeriod(periodValue)) {
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
      : getBogotaPeriodRange(periodValue === "custom" ? "today" : periodValue);

  const [clientsResult, salesResult, paymentsResult] = await Promise.all([
    context.supabase.from("clients").select("*").order("full_name"),
    context.supabase
      .from("sales")
      .select(
        "id, client_id, created_at, payment_method, settlement_type, gross_total, discount_total, net_total, estimated_cost, gross_profit, items_count, sale_status, client:clients(full_name, pricing_type), sale_items(id, quantity, unit_price, line_total, product:products(name))"
      )
      .not("client_id", "is", null)
      .gte("created_at", range.startIso)
      .lt("created_at", range.endIso)
      .order("created_at", { ascending: false }),
    context.supabase
      .from("client_payments")
      .select("id, client_id, amount, payment_method, paid_by_name, notes, created_at")
      .gte("created_at", range.startIso)
      .lt("created_at", range.endIso)
      .order("created_at", { ascending: false })
  ]);

  if (clientsResult.error) {
    return NextResponse.json(
      { error: clientsResult.error.message ?? "No fue posible cargar clientes." },
      { status: 400 }
    );
  }

  if (salesResult.error) {
    return NextResponse.json(
      { error: salesResult.error.message ?? "No fue posible cargar el reporte de clientes." },
      { status: 400 }
    );
  }

  if (paymentsResult.error) {
    return NextResponse.json(
      { error: paymentsResult.error.message ?? "No fue posible cargar los pagos de clientes." },
      { status: 400 }
    );
  }

  const clients = (clientsResult.data ?? []).map((row) => mapClientRecord(row as Record<string, unknown>));
  const transactions = (salesResult.data ?? []).map((row) =>
    mapClientTransactionRecord(row as Record<string, unknown>)
  );
  const payments = (paymentsResult.data ?? []).map((row) =>
    mapClientPaymentRecord(row as Record<string, unknown>)
  );

  const selectedClient =
    selectedClientId ? clients.find((client) => client.id === selectedClientId) ?? null : null;

  let tabAccountTransactions = transactions;
  let tabAccountPayments = payments;

  if (selectedClient?.pricingType === "fiado") {
    const [allTabSalesResult, allPaymentsResult] = await Promise.all([
      context.supabase
        .from("sales")
        .select(
          "id, client_id, created_at, payment_method, settlement_type, gross_total, discount_total, net_total, estimated_cost, gross_profit, items_count, sale_status, client:clients(full_name, pricing_type), sale_items(id, quantity, unit_price, line_total, product:products(name))"
        )
        .eq("client_id", selectedClient.id)
        .eq("sale_status", "pending")
        .order("created_at", { ascending: false }),
      context.supabase
        .from("client_payments")
        .select("id, client_id, amount, payment_method, paid_by_name, notes, created_at")
        .eq("client_id", selectedClient.id)
        .order("created_at", { ascending: false })
    ]);

    if (allTabSalesResult.error) {
      return NextResponse.json(
        { error: allTabSalesResult.error.message ?? "No fue posible cargar la cuenta del cliente." },
        { status: 400 }
      );
    }

    if (allPaymentsResult.error) {
      return NextResponse.json(
        { error: allPaymentsResult.error.message ?? "No fue posible cargar los abonos del cliente." },
        { status: 400 }
      );
    }

    tabAccountTransactions = (allTabSalesResult.data ?? []).map((row) =>
      mapClientTransactionRecord(row as Record<string, unknown>)
    );
    tabAccountPayments = (allPaymentsResult.data ?? []).map((row) =>
      mapClientPaymentRecord(row as Record<string, unknown>)
    );
  }

  const report = buildClientUsageReport({
    clients,
    transactions,
    payments,
    tabAccountTransactions,
    tabAccountPayments,
    period: periodValue,
    startDate,
    endDate,
    selectedClientId
  });

  return NextResponse.json(report);
}
