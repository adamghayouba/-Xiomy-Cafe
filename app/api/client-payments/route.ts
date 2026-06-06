import { NextResponse } from "next/server";
import { isPaymentMethod } from "@/lib/pos-data";
import { mapClientPaymentRecord } from "@/lib/pos-domain";
import { requireApiContext } from "@/lib/api-context";

export async function POST(request: Request) {
  const context = await requireApiContext();

  if (!context.ok) {
    return context.response;
  }

  if (!context.permissions["accounts.fatherTab"]) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const body = await request.json();
  const clientId = String(body.clientId ?? "").trim();
  const amount = Number(body.amount ?? 0);
  const paymentMethod = String(body.paymentMethod ?? "");
  const paidByName = String(body.paidByName ?? "").trim();
  const notes = String(body.notes ?? "").trim();

  if (!clientId || Number.isNaN(amount) || amount <= 0 || !isPaymentMethod(paymentMethod)) {
    return NextResponse.json({ error: "Datos del pago inválidos." }, { status: 400 });
  }

  const { data, error } = await context.supabase.rpc("record_client_payment", {
    p_client_id: clientId,
    p_amount: amount,
    p_payment_method: paymentMethod,
    p_paid_by_name: paidByName || null,
    p_notes: notes || null
  });

  if (error) {
    return NextResponse.json(
      { error: error.message ?? "No fue posible registrar el pago." },
      { status: 400 }
    );
  }

  return NextResponse.json({
    payment: data ? mapClientPaymentRecord(data as Record<string, unknown>) : null
  });
}
