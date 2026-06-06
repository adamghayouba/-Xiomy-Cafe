import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { SetupNotice } from "@/components/setup/setup-notice";
import { getOptionalSessionContext } from "@/lib/auth";
import { getSupabaseEnv } from "@/lib/supabase/config";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const env = getSupabaseEnv();

  if (!env.isConfigured) {
    return <SetupNotice />;
  }

  const { user } = await getOptionalSessionContext();

  if (user) {
    redirect("/");
  }

  return <LoginForm />;
}
