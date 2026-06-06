import type { User } from "@supabase/supabase-js";
import { findDemoUserByEmail } from "@/lib/demo-users";
import { mapProfileRecord } from "@/lib/pos-domain";
import { isPosRole, type PosRole } from "@/lib/pos-permissions";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

function getDesiredProfile(user: User) {
  const demoUser = user.email ? findDemoUserByEmail(user.email) : null;
  const appRole = String(user.app_metadata?.role ?? "");
  const fullName =
    String(user.user_metadata?.full_name ?? "").trim() || demoUser?.fullName || user.email || "";
  const role: PosRole = isPosRole(appRole) ? appRole : demoUser?.role ?? "cajero";

  return {
    id: user.id,
    email: user.email ?? demoUser?.email ?? "",
    fullName,
    role
  };
}

export async function ensureProfileForUser(user: User) {
  const desired = getDesiredProfile(user);
  const adminSupabase = createAdminSupabaseClient();

  const { data, error } = await adminSupabase
    .from("profiles")
    .upsert(
      {
        id: desired.id,
        email: desired.email,
        full_name: desired.fullName,
        role: desired.role
      },
      { onConflict: "id" }
    )
    .select("id, email, full_name, role")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "No fue posible preparar el perfil.");
  }

  return mapProfileRecord(data as Record<string, unknown>);
}
