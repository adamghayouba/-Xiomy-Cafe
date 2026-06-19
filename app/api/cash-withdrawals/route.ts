import { NextResponse } from "next/server";
import { requireApiContext } from "@/lib/api-context";
import { mapCashWithdrawalRecord } from "@/lib/pos-domain";

const withdrawalSelect =
  "id, business_date, amount, scope, note, created_by_label, created_at";

export async function POST(request: Request) {
  const context = await requireApiContext();

  if (!context.ok) {
    return context.response;
  }

  if (!context.permissions["cash.closeout"]) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const body = await request.json();
  const amount = Number(body.amount ?? NaN);
  const note = body.note ? String(body.note) : null;
  const scope = body.scope === "accumulated" ? "accumulated" : "shift";

  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json(
      {
        error:
          scope === "accumulated"
            ? "Debes ingresar un monto válido para el retiro de efectivo."
            : "Debes ingresar un monto válido para la salida de caja."
      },
      { status: 400 }
    );
  }

  const { data: createdData, error: createdError } = await context.supabase.rpc(
    "create_cash_withdrawal",
    {
      p_amount: amount,
      p_scope: scope,
      p_note: note
    }
  );

  if (createdError) {
    return NextResponse.json(
      {
        error:
          createdError.message ??
          (scope === "accumulated"
            ? "No fue posible registrar el retiro de efectivo."
            : "No fue posible registrar la salida de caja.")
      },
      { status: 400 }
    );
  }

  const withdrawalId = Array.isArray(createdData) ? createdData[0]?.id : createdData?.id;

  const { data, error } = await context.supabase
    .from("cash_withdrawals")
    .select(withdrawalSelect)
    .eq("id", withdrawalId)
    .single();

  if (error) {
    return NextResponse.json(
      {
        error:
          error.message ??
          (scope === "accumulated"
            ? "No fue posible cargar el retiro de efectivo guardado."
            : "No fue posible cargar la salida de caja guardada.")
      },
      { status: 400 }
    );
  }

  return NextResponse.json({
    withdrawal: mapCashWithdrawalRecord(data as Record<string, unknown>)
  });
}
