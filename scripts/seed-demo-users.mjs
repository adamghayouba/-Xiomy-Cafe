import { createClient } from "@supabase/supabase-js";
import managedUsers from "../config/managed-users.json" with { type: "json" };

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

if (!url || !serviceRoleKey) {
  throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.");
}

const supabase = createClient(url, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

for (const user of managedUsers) {
  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email: user.email,
    password: user.password,
    email_confirm: true,
    app_metadata: { role: user.role },
    user_metadata: { full_name: user.fullName }
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
    user_metadata: { full_name: user.fullName },
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
        full_name: user.fullName,
        role: user.role
      },
      { onConflict: "id" }
    );

  if (profileError) {
    throw profileError;
  }

  console.log(`Ready: ${user.email}`);
}
