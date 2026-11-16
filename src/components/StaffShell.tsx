import Link from "next/link";
import type { StaffUser } from "@/lib/types";
import { LogoutButton } from "@/components/LogoutButton";

export function StaffShell({
  user,
  children,
}: {
  user: StaffUser;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-[var(--line)] bg-white/50 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
          <Link href="/dashboard" className="flex items-baseline gap-2">
            <span
              className="text-2xl font-semibold tracking-tight"
              style={{ fontFamily: "var(--font-display), serif" }}
            >
              Presence
            </span>
            <span className="hidden text-sm text-[var(--ink-muted)] sm:inline">
              staff console
            </span>
          </Link>
          <div className="flex items-center gap-3 text-sm">
            <div className="text-right">
              <div className="font-semibold">{user.full_name}</div>
              <div className="capitalize text-[var(--ink-muted)]">{user.role}</div>
            </div>
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
