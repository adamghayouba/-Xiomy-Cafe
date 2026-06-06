import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { mapProfileRecord } from "@/lib/pos-domain";
import { ensureProfileForUser } from "@/lib/profile-repair";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function getSafeCurrentUser(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>
) {
  try {
    const { data, error } = await supabase.auth.getUser();

    if (error) {
      return null;
    }

    return data.user ?? null;
  } catch {
    return null;
  }
}

async function getProfileForUser(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  user: User
) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, full_name, role")
    .eq("id", user.id)
    .single();

  if (error || !data) {
    return ensureProfileForUser(user);
  }

  return mapProfileRecord(data as Record<string, unknown>);
}

export async function getOptionalSessionContext() {
  const supabase = await createServerSupabaseClient();
  const user = await getSafeCurrentUser(supabase);

  if (!user) {
    return {
      supabase,
      user: null,
      profile: null
    };
  }

  const profile = await getProfileForUser(supabase, user);

  return {
    supabase,
    user,
    profile
  };
}

export async function requireSessionContext() {
  const context = await getOptionalSessionContext();

  if (!context.user || !context.profile) {
    redirect("/login");
  }

  return {
    supabase: context.supabase,
    user: context.user,
    profile: context.profile
  };
}
