export function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

  return {
    url,
    publishableKey,
    serviceRoleKey,
    isConfigured: Boolean(url && publishableKey)
  };
}

export function assertSupabaseEnv() {
  const env = getSupabaseEnv();

  if (!env.isConfigured) {
    throw new Error("Supabase no está configurado. Revisa NEXT_PUBLIC_SUPABASE_URL y la key pública.");
  }

  return env;
}
