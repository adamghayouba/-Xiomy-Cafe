import { getRolePermissions } from "@/lib/pos-permissions";
import { getCashierProfileIds } from "@/lib/cash-drawer";
import {
  mapClientRecord,
  mapProductRecord,
  mapSaleRecord,
  mapSummaryRecord
} from "@/lib/pos-domain";
import { getBogotaDayRange } from "@/lib/pos-utils";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { PosBootstrapData, PosProfile } from "@/lib/pos-types";

function formatBootstrapError(scope: string, message: string) {
  return `No fue posible cargar ${scope} desde Supabase: ${message}`;
}

export async function getPosBootstrapData(
  supabase: any,
  profile: PosProfile
): Promise<PosBootstrapData> {
  const permissions = getRolePermissions(profile.role);
  const dayRange = getBogotaDayRange();
  const salesColumns =
    "id, created_at, payment_method, settlement_type, gross_total, discount_total, net_total, estimated_cost, gross_profit, items_count, sale_status, is_cancelled, cancellation_reason, cancellation_requested_at, cancellation_approved_at, cancellation_request_status, client:clients(full_name, pricing_type)";

  const productsQuery =
    profile.role === "jefa"
      ? supabase.from("products").select("*").is("archived_at", null).order("name")
      : supabase
          .from("products")
          .select(
            "id, name, category, subcategory, price, description, image, active, track_stock, stock_quantity, low_stock_threshold"
          )
          .eq("active", true)
          .is("archived_at", null)
          .order("name");

  const clientsQuery =
    profile.role === "jefa"
      ? supabase.from("clients").select("*").order("full_name")
      : supabase.from("clients").select("*").eq("active", true).order("full_name");

  const recentSalesPromise = permissions["sales.history"]
    ? supabase
        .from("sales")
        .select(salesColumns)
        .gte("created_at", dayRange.startIso)
        .lt("created_at", dayRange.endIso)
        .order("created_at", { ascending: false })
        .limit(10)
    : permissions["sales.cancel.request"]
      ? (async () => {
          const adminSupabase = createAdminSupabaseClient();
          const cashierIds = await getCashierProfileIds(adminSupabase);

          if (!cashierIds.length) {
            return { data: [], error: null };
          }

          return adminSupabase
            .from("sales")
            .select(salesColumns)
            .in("cashier_user_id", cashierIds)
            .gte("created_at", dayRange.startIso)
            .lt("created_at", dayRange.endIso)
            .order("created_at", { ascending: false })
            .limit(8);
        })()
      : Promise.resolve({ data: [], error: null });

  const [
    { data: productRows, error: productsError },
    { data: clientRows, error: clientsError },
    { data: summaryRows, error: summaryError },
    recentSalesResult
  ] = await Promise.all([
    productsQuery,
    clientsQuery,
    supabase.rpc("sales_today_summary"),
    recentSalesPromise
  ]);

  if (productsError) {
    throw new Error(formatBootstrapError("productos", productsError.message));
  }

  if (summaryError) {
    throw new Error(formatBootstrapError("resumen diario", summaryError.message));
  }

  if (clientsError) {
    throw new Error(formatBootstrapError("clientes", clientsError.message));
  }

  if (recentSalesResult.error) {
    throw new Error(formatBootstrapError("historial de ventas", recentSalesResult.error.message));
  }

  return {
    profile,
    products: (productRows ?? []).map((row: Record<string, unknown>) => mapProductRecord(row)),
    clients: (clientRows ?? []).map((row: Record<string, unknown>) => mapClientRecord(row)),
    recentSales: (recentSalesResult.data ?? []).map((row: Record<string, unknown>) =>
      mapSaleRecord(row)
    ),
    dailySummary: mapSummaryRecord(Array.isArray(summaryRows) ? summaryRows[0] : summaryRows)
  };
}

export function getProductFiltersForDay() {
  return getBogotaDayRange();
}
