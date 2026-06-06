import { NextResponse } from "next/server";
import { getSafeCurrentUser } from "@/lib/auth";
import { mapProfileRecord } from "@/lib/pos-domain";
import { getRolePermissions } from "@/lib/pos-permissions";
import { ensureProfileForUser } from "@/lib/profile-repair";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function requireApiContext() {
  const supabase = await createServerSupabaseClient();
  const user = await getSafeCurrentUser(supabase);

  if (!user) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "No autenticado." }, { status: 401 })
    };
  }

  const { data: profileData, error } = await supabase
    .from("profiles")
    .select("id, email, full_name, role")
    .eq("id", user.id)
    .single();

  let profile =
    !error && profileData
      ? mapProfileRecord(profileData as Record<string, unknown>)
      : null;

  if (!profile) {
    try {
      profile = await ensureProfileForUser(user);
    } catch {
      return {
        ok: false as const,
        response: NextResponse.json(
          { error: "Perfil no disponible para este usuario." },
          { status: 403 }
        )
      };
    }
  }

  return {
    ok: true as const,
    supabase,
    user,
    profile,
    permissions: getRolePermissions(profile.role)
  };
}
