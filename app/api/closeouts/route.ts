import { NextResponse } from "next/server";
import { requireApiContext } from "@/lib/api-context";
import {
  mapCashCloseoutRecord,
  mapCashCloseoutSnapshotRecord,
  mapCashWithdrawalRecord
} from "@/lib/pos-domain";

const closeoutSelect =
  "id, business_date, starting_cash, counted_cash, expected_cash, difference, notes, closed_by_label, cashier_label, created_at, reviewed_by_label, reviewed_at";
const withdrawalSelect =
  "id, business_date, amount, note, created_by_label, created_at";

export async function GET(request: Request) {
  const context = await requireApiContext();

  if (!context.ok) {
    return context.response;
  }

  if (!context.permissions["cash.closeout"]) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const url = new URL(request.url);
  const startingCash = Number(url.searchParams.get("startingCash") ?? 0);
  const safeStartingCash = Number.isFinite(startingCash) ? startingCash : 0;

  const withdrawalsQuery = context.supabase
    .from("cash_withdrawals")
    .select(withdrawalSelect)
    .order("created_at", { ascending: false })
    .limit(context.permissions["cash.closeout.review"] ? 20 : 10);

  const [snapshotResult, historyResult, withdrawalsResult] = await Promise.all([
    context.supabase.rpc("cash_closeout_snapshot", {
      p_starting_cash: safeStartingCash
    }),
    context.supabase
      .from("cash_closeouts")
      .select(closeoutSelect)
      .order("created_at", { ascending: false })
      .limit(context.permissions["cash.closeout.review"] ? 20 : 5),
    withdrawalsQuery
  ]);

  if (snapshotResult.error) {
    return NextResponse.json(
      { error: snapshotResult.error.message ?? "No fue posible calcular el cierre de caja." },
      { status: 400 }
    );
  }

  if (historyResult.error) {
    return NextResponse.json(
      { error: historyResult.error.message ?? "No fue posible cargar el historial de cierres." },
      { status: 400 }
    );
  }

  if (withdrawalsResult.error) {
    return NextResponse.json(
      { error: withdrawalsResult.error.message ?? "No fue posible cargar las salidas de caja." },
      { status: 400 }
    );
  }

  const snapshot = mapCashCloseoutSnapshotRecord(
    Array.isArray(snapshotResult.data) ? snapshotResult.data[0] : snapshotResult.data
  );

  return NextResponse.json({
    snapshot,
    history: (historyResult.data ?? []).map((row) =>
      mapCashCloseoutRecord(row as Record<string, unknown>)
    ),
    withdrawals: (withdrawalsResult.data ?? []).map((row) =>
      mapCashWithdrawalRecord(row as Record<string, unknown>)
    )
  });
}

export async function POST(request: Request) {
  const context = await requireApiContext();

  if (!context.ok) {
    return context.response;
  }

  if (!context.permissions["cash.closeout"]) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const body = await request.json();
  const startingCash = Number(body.startingCash ?? 0);
  const countedCash = Number(body.countedCash ?? NaN);
  const notes = body.notes ? String(body.notes) : null;

  if (!Number.isFinite(startingCash) || startingCash < 0 || !Number.isFinite(countedCash) || countedCash < 0) {
    return NextResponse.json(
      { error: "Debes ingresar valores válidos para fondo inicial y efectivo contado." },
      { status: 400 }
    );
  }

  const { data: createdData, error: createdError } = await context.supabase.rpc(
    "create_cash_closeout",
    {
      p_starting_cash: startingCash,
      p_counted_cash: countedCash,
      p_notes: notes
    }
  );

  if (createdError) {
    return NextResponse.json(
      { error: createdError.message ?? "No fue posible guardar el cierre de caja." },
      { status: 400 }
    );
  }

  const closeoutId = Array.isArray(createdData) ? createdData[0]?.id : createdData?.id;
  const [closeoutResult, snapshotResult] = await Promise.all([
    context.supabase.from("cash_closeouts").select(closeoutSelect).eq("id", closeoutId).single(),
    context.supabase.rpc("cash_closeout_snapshot", {
      p_starting_cash: startingCash
    })
  ]);

  if (closeoutResult.error) {
    return NextResponse.json(
      { error: closeoutResult.error.message ?? "No fue posible cargar el cierre guardado." },
      { status: 400 }
    );
  }

  if (snapshotResult.error) {
    return NextResponse.json(
      { error: snapshotResult.error.message ?? "No fue posible recalcular el cierre." },
      { status: 400 }
    );
  }

  return NextResponse.json({
    closeout: mapCashCloseoutRecord(closeoutResult.data as Record<string, unknown>),
    snapshot: mapCashCloseoutSnapshotRecord(
      Array.isArray(snapshotResult.data) ? snapshotResult.data[0] : snapshotResult.data
    )
  });
}

export async function PATCH(request: Request) {
  const context = await requireApiContext();

  if (!context.ok) {
    return context.response;
  }

  if (!context.permissions["cash.closeout.review"]) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const body = await request.json();
  const closeoutId = String(body.closeoutId ?? "").trim();

  if (!closeoutId) {
    return NextResponse.json({ error: "Debes indicar el cierre a revisar." }, { status: 400 });
  }

  const { data, error } = await context.supabase.rpc("acknowledge_cash_closeout", {
    p_closeout_id: closeoutId
  });

  if (error) {
    return NextResponse.json(
      { error: error.message ?? "No fue posible marcar el cierre como revisado." },
      { status: 400 }
    );
  }

  return NextResponse.json({
    closeout: data ? mapCashCloseoutRecord(data as Record<string, unknown>) : null
  });
}
