"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "@/app/login/actions";

const initialState: LoginState = {
  error: null
};

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    <form action={formAction} className="panel mx-auto max-w-md p-6 sm:p-8">
      <p className="eyebrow">Ingreso</p>
      <h1 className="headline mt-3" style={{ fontFamily: "var(--font-display)" }}>
        Gastrobar Raices
      </h1>
      <p className="mt-3 text-sm subtle">
        Inicia sesión para abrir ventas, productos y reportes según tu perfil.
      </p>

      <div className="mt-6 grid gap-4">
        <label className="grid gap-2">
          <span className="text-sm font-medium">Usuario</span>
          <input
            type="text"
            name="login"
            placeholder="jefa1"
            className="rounded-2xl border border-[var(--border)] px-4 py-3 text-sm outline-none transition focus:border-[var(--accent)]"
          />
        </label>

        <label className="grid gap-2">
          <span className="text-sm font-medium">Contraseña</span>
          <input
            type="password"
            name="password"
            placeholder="abc123"
            className="rounded-2xl border border-[var(--border)] px-4 py-3 text-sm outline-none transition focus:border-[var(--accent)]"
          />
        </label>

        {state.error ? (
          <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-rose-200">
            {state.error}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className="rounded-2xl bg-ink px-4 py-4 text-sm font-semibold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {pending ? "Entrando..." : "Iniciar sesión"}
        </button>
      </div>
    </form>
  );
}
