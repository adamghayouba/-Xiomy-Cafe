import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

if (!url || !serviceRoleKey) {
  throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.");
}

const demoUsers = [
  { email: "jefa1@xiomycafe.com", password: "abc123", full_name: "Xiomy", role: "jefa" },
  { email: "jefa2@xiomycafe.com", password: "abc123", full_name: "Angie", role: "jefa" },
  { email: "cajera1@xiomycafe.com", password: "abc123", full_name: "Cajera", role: "cajero" },
  { email: "cajera2@xiomycafe.com", password: "abc123", full_name: "Cajera", role: "cajero" }
];

const supabase = createClient(url, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

for (const user of demoUsers) {
  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email: user.email,
    password: user.password,
    email_confirm: true,
    app_metadata: { role: user.role },
    user_metadata: { full_name: user.full_name }
  });

  let authUser = created.user;

  if (createError || !authUser) {
    const { data: listed, error: listError } = await supabase.auth.admin.listUsers();

    if (listError) {
      throw listError;
    }

    authUser = listed.users.find((item) => item.email?.toLowerCase() === user.email.toLowerCase()) ?? null;
  }

  if (!authUser) {
    throw createError ?? new Error(`No fue posible encontrar o crear ${user.email}.`);
  }

  const { error: updateError } = await supabase.auth.admin.updateUserById(authUser.id, {
    password: user.password,
    app_metadata: { role: user.role },
    user_metadata: { full_name: user.full_name },
    email_confirm: true
  });

  if (updateError) {
    throw updateError;
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .upsert(
      {
        id: authUser.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role
      },
      { onConflict: "id" }
    );

  if (profileError) {
    throw profileError;
  }

  console.log(`Ready: ${user.email}`);
}
