import { getBogotaDayRange, getTodayKey } from "@/lib/pos-utils";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

type SupabaseLike = {
  from: (table: string) => {
    select: (columns: string) => any;
  };
};

export async function getAccumulatedCashInBox(
  supabase: SupabaseLike,
  cashierUserId: string,
  referenceDate = getTodayKey()
) {
  const [closeoutsResult, withdrawalsResult] = await Promise.all([
    supabase
      .from("cash_closeouts")
      .select("counted_cash")
      .eq("cashier_user_id", cashierUserId)
      .lt("business_date", referenceDate),
    supabase
      .from("cash_withdrawals")
      .select("amount")
      .eq("created_by_user_id", cashierUserId)
      .eq("scope", "accumulated")
      .lt("business_date", referenceDate)
  ]);

  const errors = [closeoutsResult.error, withdrawalsResult.error].filter(Boolean);

  if (errors.length) {
    throw new Error(errors[0]?.message ?? "No fue posible calcular el efectivo acumulado en caja.");
  }

  const previousClosedDayCash = (closeoutsResult.data ?? []).reduce(
    (total: number, row: Record<string, unknown>) => total + Number(row.counted_cash ?? 0),
    0
  );
  const previousDayWithdrawals = (withdrawalsResult.data ?? []).reduce(
    (total: number, row: Record<string, unknown>) => total + Number(row.amount ?? 0),
    0
  );

  return Math.max(previousClosedDayCash - previousDayWithdrawals, 0);
}

export async function getActiveCashierDrawerUserId() {
  const adminSupabase = createAdminSupabaseClient();
  const todayKey = getTodayKey();
  const dayRange = getBogotaDayRange();

  const { data: cashierProfiles, error: profilesError } = await adminSupabase
    .from("profiles")
    .select("id")
    .eq("role", "cajero");

  if (profilesError) {
    throw new Error(profilesError.message ?? "No fue posible cargar las cajeras.");
  }

  const cashierIds = (cashierProfiles ?? []).map((profile) => String(profile.id));

  if (!cashierIds.length) {
    return null;
  }

  const [latestSale, latestCloseout, latestWithdrawal, latestPayment, latestHistoricalCloseout] =
    await Promise.all([
      adminSupabase
        .from("sales")
        .select("cashier_user_id, created_at")
        .in("cashier_user_id", cashierIds)
        .gte("created_at", dayRange.startIso)
        .lt("created_at", dayRange.endIso)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      adminSupabase
        .from("cash_closeouts")
        .select("cashier_user_id, created_at")
        .in("cashier_user_id", cashierIds)
        .eq("business_date", todayKey)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      adminSupabase
        .from("cash_withdrawals")
        .select("created_by_user_id, created_at")
        .in("created_by_user_id", cashierIds)
        .gte("created_at", dayRange.startIso)
        .lt("created_at", dayRange.endIso)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      adminSupabase
        .from("client_payments")
        .select("created_by_user_id, created_at")
        .in("created_by_user_id", cashierIds)
        .gte("created_at", dayRange.startIso)
        .lt("created_at", dayRange.endIso)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      adminSupabase
        .from("cash_closeouts")
        .select("cashier_user_id, created_at")
        .in("cashier_user_id", cashierIds)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    ]);

  const candidates = [
    latestSale.data
      ? { userId: String(latestSale.data.cashier_user_id), createdAt: String(latestSale.data.created_at) }
      : null,
    latestCloseout.data
      ? { userId: String(latestCloseout.data.cashier_user_id), createdAt: String(latestCloseout.data.created_at) }
      : null,
    latestWithdrawal.data
      ? { userId: String(latestWithdrawal.data.created_by_user_id), createdAt: String(latestWithdrawal.data.created_at) }
      : null,
    latestPayment.data
      ? { userId: String(latestPayment.data.created_by_user_id), createdAt: String(latestPayment.data.created_at) }
      : null,
    latestHistoricalCloseout.data
      ? {
          userId: String(latestHistoricalCloseout.data.cashier_user_id),
          createdAt: String(latestHistoricalCloseout.data.created_at)
        }
      : null
  ].filter((candidate): candidate is { userId: string; createdAt: string } => Boolean(candidate));

  if (!candidates.length) {
    return cashierIds[0] ?? null;
  }

  candidates.sort((left, right) => right.createdAt.localeCompare(left.createdAt));

  return candidates[0]?.userId ?? null;
}
