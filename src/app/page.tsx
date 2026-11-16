import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentStaff } from "@/lib/auth/current-user";
import { isDemoMode } from "@/lib/config";

export default async function HomePage() {
  const user = await getCurrentStaff();
  if (user) redirect("/dashboard");

  return (
    <div className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center px-4 py-16">
      <div className="fade-up max-w-2xl">
        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--brand)]">
          Lecturers & TAs only
        </p>
        <h1
          className="mb-4 text-5xl font-semibold leading-[1.05] tracking-tight md:text-6xl"
          style={{ fontFamily: "var(--font-display), serif" }}
        >
          Presence
        </h1>
        <p className="mb-8 max-w-xl text-lg text-[var(--ink-muted)]">
          Start a timed session, project a rotating signed QR code, and record
          student check-ins with face match and classroom location — without
          student accounts.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/signup" className="btn btn-primary">
            Create staff account
          </Link>
          <Link href="/login" className="btn btn-secondary">
            Log in
          </Link>
        </div>
        {isDemoMode() && (
          <p className="mt-6 text-sm text-[var(--ink-muted)]">
            Running in demo mode (local store). Connect Supabase env vars for
            production.
          </p>
        )}
      </div>
    </div>
  );
}
