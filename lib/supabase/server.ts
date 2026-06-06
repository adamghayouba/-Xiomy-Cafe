import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { assertSupabaseEnv } from "@/lib/supabase/config";

export async function createServerSupabaseClient() {
  const cookieStore = await cookies();
  const env = assertSupabaseEnv();

  return createServerClient(env.url, env.publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components can read cookies but may not always be able to write them.
        }
      }
    }
  });
}
