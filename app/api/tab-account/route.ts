import { NextResponse } from "next/server";
import {
  buildClientTabAccount,
  buildClientTabAccountSummary,
  mapClientPaymentRecord,
  mapClientRecord,
  mapClientTransactionRecord
} from "@/lib/pos-domain";
import { requireApiContext } from "@/lib/api-context";

export async function GET(request: Request) {
  const context = await requireApiContext();

  if (!context.ok) {
    return context.response;
  }

  if (!context.permissions["accounts.fatherTab"]) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const url = new URL(request.url);
  const selectedClientId = String(url.searchParams.get("clientId") ?? "").trim();

  const { data: fiadoRows, error: fiadoError } = await context.supabase
    .from("clients")
    .select("*")
    .eq("pricing_type", "fiado")
    .eq("active", true)
    .order("full_name");

  if (fiadoError) {
    return NextResponse.json(
      { error: fiadoError.message ?? "No fue posible cargar las cuentas pendientes." },
      { status: 400 }
    );
  }

  const fiadoClients = (fiadoRows ?? []).map((row) => mapClientRecord(row as Record<string, unknown>));
  const resolvedClientId =
    selectedClientId && fiadoClients.some((client) => client.id === selectedClientId)
      ? selectedClientId
      : fiadoClients[0]?.id ?? null;

  if (!resolvedClientId) {
    return NextResponse.json({
      accounts: [],
      selectedClientId: null,
      account: null
    });
  }

  const [salesResult, paymentsResult] = await Promise.all([
    context.supabase
      .from("sales")
      .select(
        "id, client_id, created_at, payment_method, settlement_type, gross_total, discount_total, net_total, estimated_cost, gross_profit, items_count, sale_status, client:clients(full_name, pricing_type), sale_items(id, quantity, unit_price, line_total, product:products(name))"
      )
      .in(
        "client_id",
        fiadoClients.map((client) => client.id)
      )
      .eq("sale_status", "pending")
      .order("created_at", { ascending: false }),
    context.supabase
      .from("client_payments")
      .select("id, client_id, amount, payment_method, paid_by_name, notes, created_at")
      .in(
        "client_id",
        fiadoClients.map((client) => client.id)
      )
      .order("created_at", { ascending: false })
  ]);

  if (salesResult.error) {
    return NextResponse.json(
      { error: salesResult.error.message ?? "No fue posible cargar los consumos en cuenta." },
      { status: 400 }
    );
  }

  if (paymentsResult.error) {
    return NextResponse.json(
      { error: paymentsResult.error.message ?? "No fue posible cargar los abonos de cuenta." },
      { status: 400 }
    );
  }

  const transactions = (salesResult.data ?? []).map((row) =>
    mapClientTransactionRecord(row as Record<string, unknown>)
  );
  const payments = (paymentsResult.data ?? []).map((row) =>
    mapClientPaymentRecord(row as Record<string, unknown>)
  );

  const accounts = fiadoClients
    .map((client) =>
      buildClientTabAccount({
        client,
        transactions: transactions.filter((transaction) => transaction.clientId === client.id),
        payments: payments.filter((payment) => payment.clientId === client.id)
      })
    )
    .sort((left, right) => left.clientName.localeCompare(right.clientName));

  const selectedAccount = accounts.find((account) => account.clientId === resolvedClientId) ?? null;

  return NextResponse.json({
    accounts: accounts.map(buildClientTabAccountSummary),
    selectedClientId: resolvedClientId,
    account: selectedAccount
  });
}
