import { logoutAction } from "@/app/login/actions";

export function LogoutButton() {
  return (
    <form action={logoutAction}>
      <button
        type="submit"
        className="rounded-full bg-white px-4 py-2 text-sm font-semibold ring-1 ring-[var(--border)] transition hover:ring-[var(--accent)]"
      >
        Salir
      </button>
    </form>
  );
}
