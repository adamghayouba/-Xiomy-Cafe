import Link from "next/link";

export default function NotFound() {
  return (
    <div className="panel mx-auto max-w-xl p-8 text-center">
      <p className="eyebrow">Page not found</p>
      <h1 className="mt-2 text-3xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>
        This route is not part of the pilot yet.
      </h1>
      <p className="mt-3 text-sm leading-6 subtle">
        Head back to the dashboard and continue exploring the MVP shell.
      </p>
      <Link
        href="/dashboard"
        className="mt-6 inline-flex rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white"
      >
        Go to dashboard
      </Link>
    </div>
  );
}
