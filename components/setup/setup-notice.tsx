type SetupNoticeProps = {
  title?: string;
  description?: string;
  detail?: string;
};

export function SetupNotice({
  title = "Conecta Supabase para activar el backend real del POS",
  description = "Este build ya quedó preparado para autenticación, roles, productos y ventas en Supabase.",
  detail
}: SetupNoticeProps) {
  return (
    <section className="panel p-6 sm:p-8">
      <p className="eyebrow">Configuración pendiente</p>
      <h1 className="headline mt-3" style={{ fontFamily: "var(--font-display)" }}>
        {title}
      </h1>
      <div className="mt-5 space-y-4 text-sm leading-7 subtle">
        <p>{description}</p>
        <p>
          Antes de usarlo necesitas definir `NEXT_PUBLIC_SUPABASE_URL` y
          `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` en `.env.local`, y luego ejecutar el SQL de
          [supabase/schema.sql](/Users/adamghayouba/Xiomy-Cafe/supabase/schema.sql).
        </p>
        <p>
          También dejé un script para crear 2 usuarias `jefa` y 2 usuarios `cajero` en
          [scripts/seed-demo-users.mjs](/Users/adamghayouba/Xiomy-Cafe/scripts/seed-demo-users.mjs).
        </p>
        {detail ? (
          <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-rose-200">
            {detail}
          </div>
        ) : null}
      </div>
    </section>
  );
}
