import Link from "next/link";
import type { ReactNode } from "react";
import { LogoutButton } from "@/components/auth/logout-button";
import { FiadoOpenButton } from "@/components/fiado-open-button";
import { getOptionalSessionContext } from "@/lib/auth";
import { formatProfileIdentity, getProfileTheme } from "@/lib/pos-permissions";
import { getSupabaseEnv } from "@/lib/supabase/config";

export async function AppShell({ children }: { children: ReactNode }) {
  const env = getSupabaseEnv();
  const session = env.isConfigured ? await getOptionalSessionContext() : null;
  const profileTheme = session?.profile ? getProfileTheme(session.profile.role) : "cajera";
  const identityLabel = session?.profile
    ? formatProfileIdentity(session.profile.role, session.profile.fullName)
    : null;

  return (
    <div className="shell" data-profile-theme={profileTheme}>
      <header className="panel header-panel mb-6 px-5 py-4 sm:px-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <Link href="/" className="text-xl font-semibold sm:text-2xl">
              Gastrobar Raices
            </Link>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-sm subtle">
            <span className="pill">Cestillal</span>
            {env.isConfigured && session?.profile?.role !== "jefa" ? <FiadoOpenButton /> : null}
            {session?.profile ? (
              <>
                <span className="identity-chip rounded-full px-4 py-2 text-sm font-semibold ring-1 ring-[var(--border)]">
                  {identityLabel}
                </span>
                <LogoutButton />
              </>
            ) : null}
          </div>
        </div>
      </header>

      <main>{children}</main>
    </div>
  );
}
