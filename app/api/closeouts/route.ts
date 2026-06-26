import { NextResponse } from "next/server";
import { requireApiContext } from "@/lib/api-context";
import {
  mapCashCloseoutRecord,
  mapCashCloseoutSnapshotRecord,
  mapCashWithdrawalRecord
} from "@/lib/pos-domain";
import {
  getAccumulatedCashInBox,
  getCashierProfileIds,
  getSharedAccumulatedCashInBox
} from "@/lib/cash-drawer";
import { getBogotaDayRange, getTodayKey } from "@/lib/pos-utils";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const closeoutSelect =
  "id, business_date, starting_cash, counted_cash, expected_cash, difference, notes, closed_by_label, cashier_label, created_at, reviewed_by_label, reviewed_at";
const withdrawalSelect =
  "id, business_date, amount, scope, note, created_by_label, created_at";

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

  if (context.profile.role === "cajero") {
    const adminSupabase = createAdminSupabaseClient();
    const cashierIds = await getCashierProfileIds(adminSupabase);
    const todayKey = getTodayKey();
    const dayRange = getBogotaDayRange();

    if (!cashierIds.length) {
      return NextResponse.json({
        snapshot: mapCashCloseoutSnapshotRecord({
          business_date: todayKey,
          starting_cash: safeStartingCash,
          cash_sales: 0,
          transfer_sales: 0,
          fiado_generated: 0,
          family_consumption: 0,
          repayments_received: 0,
          cash_withdrawals: 0,
          cancelled_sales: 0,
          expected_cash: 0,
          accumulated_cash: 0,
          total_available_cash: 0
        }),
        history: [],
        withdrawals: []
      });
    }

    const [latestCloseoutResult, historyResult, withdrawalsResult, accumulatedCash] =
      await Promise.all([
        adminSupabase
          .from("cash_closeouts")
          .select("created_at")
          .in("cashier_user_id", cashierIds)
          .eq("business_date", todayKey)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        adminSupabase
          .from("cash_closeouts")
          .select(closeoutSelect)
          .in("cashier_user_id", cashierIds)
          .order("created_at", { ascending: false })
          .limit(5),
        adminSupabase
          .from("cash_withdrawals")
          .select(withdrawalSelect)
          .in("created_by_user_id", cashierIds)
          .order("created_at", { ascending: false })
          .limit(10),
        getSharedAccumulatedCashInBox(todayKey)
      ]);

    if (latestCloseoutResult.error) {
      return NextResponse.json(
        {
          error:
            latestCloseoutResult.error.message ??
            "No fue posible cargar el último cierre de caja."
        },
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
        {
          error:
            withdrawalsResult.error.message ??
            "No fue posible cargar las salidas de caja."
        },
        { status: 400 }
      );
    }

    const rangeStart = latestCloseoutResult.data?.created_at
      ? String(latestCloseoutResult.data.created_at)
      : dayRange.startIso;

    const [salesWindowResult, paymentsWindowResult, withdrawalsWindowResult] =
      await Promise.all([
        adminSupabase
          .from("sales")
          .select(
            "payment_method, gross_total, net_total, sale_status, is_cancelled, cancellation_approved_at"
          )
          .in("cashier_user_id", cashierIds)
          .gte("created_at", rangeStart)
          .lt("created_at", dayRange.endIso),
        adminSupabase
          .from("client_payments")
          .select("amount, payment_method")
          .in("created_by_user_id", cashierIds)
          .gte("created_at", rangeStart)
          .lt("created_at", dayRange.endIso),
        adminSupabase
          .from("cash_withdrawals")
          .select("amount, scope")
          .in("created_by_user_id", cashierIds)
          .gte("created_at", rangeStart)
          .lt("created_at", dayRange.endIso)
      ]);

    const windowErrors = [
      salesWindowResult.error,
      paymentsWindowResult.error,
      withdrawalsWindowResult.error
    ].filter(Boolean);

    if (windowErrors.length) {
      return NextResponse.json(
        {
          error:
            windowErrors[0]?.message ?? "No fue posible calcular el cierre de caja compartido."
        },
        { status: 400 }
      );
    }

    const salesRows = (salesWindowResult.data ?? []) as Record<string, unknown>[];
    const paymentRows = (paymentsWindowResult.data ?? []) as Record<string, unknown>[];
    const withdrawalRows = (withdrawalsWindowResult.data ?? []) as Record<string, unknown>[];

    const cashSales = salesRows.reduce((total, sale) => {
      return !sale.is_cancelled && sale.sale_status === "paid" && sale.payment_method === "Efectivo"
        ? total + Number(sale.net_total ?? 0)
        : total;
    }, 0);
    const transferSales = salesRows.reduce((total, sale) => {
      return !sale.is_cancelled &&
        sale.sale_status === "paid" &&
        sale.payment_method === "Transferencia"
        ? total + Number(sale.net_total ?? 0)
        : total;
    }, 0);
    const fiadoGenerated = salesRows.reduce((total, sale) => {
      return !sale.is_cancelled && sale.sale_status === "pending"
        ? total + Number(sale.gross_total ?? 0)
        : total;
    }, 0);
    const familyConsumption = salesRows.reduce((total, sale) => {
      return !sale.is_cancelled && sale.sale_status === "discounted"
        ? total + Number(sale.gross_total ?? 0)
        : total;
    }, 0);
    const cancelledSales = salesRows.reduce((total, sale) => {
      const approvedAt = sale.cancellation_approved_at ? String(sale.cancellation_approved_at) : null;
      return sale.is_cancelled && approvedAt && approvedAt >= rangeStart && approvedAt < dayRange.endIso
        ? total + Number(sale.gross_total ?? 0)
        : total;
    }, 0);
    const repaymentsReceived = paymentRows.reduce(
      (total, payment) => total + Number(payment.amount ?? 0),
      0
    );
    const repaymentsCash = paymentRows.reduce((total, payment) => {
      return payment.payment_method === "Efectivo"
        ? total + Number(payment.amount ?? 0)
        : total;
    }, 0);
    const cashWithdrawals = withdrawalRows.reduce((total, withdrawal) => {
      return withdrawal.scope === "shift" ? total + Number(withdrawal.amount ?? 0) : total;
    }, 0);
    const expectedCash = safeStartingCash + cashSales + repaymentsCash - cashWithdrawals;

    return NextResponse.json({
      snapshot: {
        businessDate: todayKey,
        startingCash: safeStartingCash,
        cashSales,
        transferSales,
        fiadoGenerated,
        familyConsumption,
        repaymentsReceived,
        cashWithdrawals,
        cancelledSales,
        expectedCash,
        accumulatedCash,
        totalAvailableCash: expectedCash + accumulatedCash
      },
      history: (historyResult.data ?? []).map((row) =>
        mapCashCloseoutRecord(row as Record<string, unknown>)
      ),
      withdrawals: (withdrawalsResult.data ?? []).map((row) =>
        mapCashWithdrawalRecord(row as Record<string, unknown>)
      )
    });
  }

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
  snapshot.accumulatedCash = await getAccumulatedCashInBox(
    context.supabase,
    context.profile.id
  );
  snapshot.totalAvailableCash = snapshot.expectedCash + snapshot.accumulatedCash;

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

  const snapshot = mapCashCloseoutSnapshotRecord(
    Array.isArray(snapshotResult.data) ? snapshotResult.data[0] : snapshotResult.data
  );
  snapshot.accumulatedCash = await getAccumulatedCashInBox(
    context.supabase,
    context.profile.id
  );
  snapshot.totalAvailableCash = snapshot.expectedCash + snapshot.accumulatedCash;

  return NextResponse.json({
    closeout: mapCashCloseoutRecord(closeoutResult.data as Record<string, unknown>),
    snapshot
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
