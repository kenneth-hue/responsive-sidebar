"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    const payload: Record<string, string> = {
      email: String(form.get("email") ?? ""),
      password: String(form.get("password") ?? ""),
    };
    if (mode === "signup") {
      payload.full_name = String(form.get("full_name") ?? "");
      payload.role = String(form.get("role") ?? "lecturer");
    }

    const res = await fetch(`/api/auth/${mode}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "Something went wrong");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="panel fade-up w-full max-w-md rounded-2xl p-6 shadow-sm">
      <h1
        className="mb-1 text-3xl font-semibold"
        style={{ fontFamily: "var(--font-display), serif" }}
      >
        {mode === "login" ? "Staff login" : "Staff sign up"}
      </h1>
      <p className="mb-6 text-sm text-[var(--ink-muted)]">
        Students never sign in. Only lecturers and teaching assistants.
      </p>

      {mode === "signup" && (
        <>
          <label className="label" htmlFor="full_name">
            Full name
          </label>
          <input className="input mb-4" id="full_name" name="full_name" required />

          <label className="label" htmlFor="role">
            Role
          </label>
          <select className="input mb-4" id="role" name="role" defaultValue="lecturer">
            <option value="lecturer">Lecturer</option>
            <option value="ta">Teaching assistant</option>
          </select>
        </>
      )}

      <label className="label" htmlFor="email">
        Email
      </label>
      <input className="input mb-4" id="email" name="email" type="email" required />

      <label className="label" htmlFor="password">
        Password
      </label>
      <input
        className="input mb-4"
        id="password"
        name="password"
        type="password"
        minLength={8}
        required
      />

      {error && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-[var(--danger)]">
          {error}
        </p>
      )}

      <button className="btn btn-primary w-full" disabled={loading} type="submit">
        {loading ? "Please wait…" : mode === "login" ? "Log in" : "Create account"}
      </button>

      <p className="mt-4 text-center text-sm text-[var(--ink-muted)]">
        {mode === "login" ? (
          <>
            Need an account? <Link href="/signup">Sign up</Link>
          </>
        ) : (
          <>
            Already registered? <Link href="/login">Log in</Link>
          </>
        )}
      </p>
    </form>
  );
}
