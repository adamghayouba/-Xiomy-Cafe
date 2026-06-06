"use server";

import { redirect } from "next/navigation";
import { findDemoUserByLogin } from "@/lib/demo-users";
import { ensureProfileForUser } from "@/lib/profile-repair";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type LoginState = {
  error: string | null;
};

function getLoginErrorMessage(message: string) {
  const normalized = message.toLowerCase();

  if (normalized.includes("invalid login credentials")) {
    return "Usuario o contraseña incorrectos.";
  }

  if (normalized.includes("email not confirmed")) {
    return "Este correo todavía no está confirmado.";
  }

  return message || "No fue posible iniciar sesión.";
}

export async function loginAction(_previousState: LoginState, formData: FormData): Promise<LoginState> {
  const login = String(formData.get("login") ?? "").trim();
  const password = String(formData.get("password") ?? "").trim();

  if (!login || !password) {
    return { error: "Escribe el usuario y la contraseña." };
  }

  const demoUser = findDemoUserByLogin(login);
  const email = demoUser?.email ?? login;

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: getLoginErrorMessage(error.message) };
  }

  if (!data.user) {
    return { error: "No fue posible abrir la sesión." };
  }

  try {
    await ensureProfileForUser(data.user);
  } catch (profileError) {
    return {
      error:
        profileError instanceof Error
          ? `El usuario existe en Auth, pero no se pudo preparar su perfil: ${profileError.message}`
          : "El usuario existe en Auth, pero no se pudo preparar su perfil."
    };
  }

  redirect("/");
}

export async function logoutAction() {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
  redirect("/login");
}
