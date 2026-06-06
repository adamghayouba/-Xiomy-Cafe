import { PosApp } from "@/components/pos/pos-app";
import { SetupNotice } from "@/components/setup/setup-notice";
import { requireSessionContext } from "@/lib/auth";
import { getPosBootstrapData } from "@/lib/pos-service";
import { getSupabaseEnv } from "@/lib/supabase/config";

export const dynamic = "force-dynamic";

export default async function LandingPage() {
  const env = getSupabaseEnv();

  if (!env.isConfigured) {
    return <SetupNotice />;
  }

  try {
    const { supabase, profile } = await requireSessionContext();
    const data = await getPosBootstrapData(supabase, profile);

    return <PosApp initialData={data} />;
  } catch (error) {
    const detail =
      error instanceof Error ? error.message : "No fue posible inicializar el POS.";

    const isInvalidApiKey = detail.toLowerCase().includes("invalid api key");

    return (
      <SetupNotice
        title={isInvalidApiKey ? "La llave de Supabase no es válida" : "No fue posible abrir el POS"}
        description={
          isInvalidApiKey
            ? "La app sí encontró Supabase, pero la URL o la llave pública no corresponden al proyecto actual."
            : "La app no pudo cargar los datos base del POS desde Supabase."
        }
        detail={detail}
      />
    );
  }
}
