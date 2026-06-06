"use client";

export function FiadoOpenButton() {
  return (
    <button
      type="button"
      onClick={() => {
        window.dispatchEvent(new CustomEvent("open-fiados"));
      }}
      className="rounded-full bg-white px-4 py-2 ring-1 ring-[var(--border)] transition hover:ring-[var(--accent)]"
    >
      Fiados
    </button>
  );
}
