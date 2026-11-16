import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/AuthForm";
import { getCurrentStaff } from "@/lib/auth/current-user";

export default async function SignupPage() {
  const user = await getCurrentStaff();
  if (user) redirect("/dashboard");

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-4 py-12">
      <Link href="/" className="mb-6 text-sm text-[var(--ink-muted)]">
        ← Presence
      </Link>
      <AuthForm mode="signup" />
    </div>
  );
}
