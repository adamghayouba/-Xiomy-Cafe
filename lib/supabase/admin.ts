import { createClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "@/lib/supabase/config";

export function createAdminSupabaseClient() {
  const env = getSupabaseEnv();

  if (!env.url || !env.serviceRoleKey) {
    throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY para operaciones administrativas.");
  }

  return createClient(env.url, env.serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}
