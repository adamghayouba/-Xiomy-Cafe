"use client";

import { usePathname } from "next/navigation";
import { LogoutButton } from "@/components/auth/logout-button";
import { FiadoOpenButton } from "@/components/fiado-open-button";

type HeaderControlsProps = {
  identityLabel: string | null;
  isConfigured: boolean;
  role: "jefa" | "cajero" | null;
};

export function HeaderControls({
  identityLabel,
  isConfigured,
  role
}: HeaderControlsProps) {
  const pathname = usePathname();
  const isLoginPage = pathname?.startsWith("/login");

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm subtle">
      <span className="pill">Cestillal</span>
      {!isLoginPage && isConfigured && role && role !== "jefa" ? <FiadoOpenButton /> : null}
      {identityLabel ? (
        <>
          <span className="identity-chip rounded-full px-4 py-2 text-sm font-semibold ring-1 ring-[var(--border)]">
            {identityLabel}
          </span>
          <LogoutButton />
        </>
      ) : null}
    </div>
  );
}
