"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function NewCourseForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/courses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: form.get("code"),
        name: form.get("name"),
      }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "Failed to create course");
      return;
    }
    router.push(`/courses/${data.course.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="panel fade-up max-w-lg rounded-2xl p-6">
      <label className="label" htmlFor="code">
        Course code
      </label>
      <input className="input mb-4" id="code" name="code" placeholder="CS301" required />

      <label className="label" htmlFor="name">
        Course name
      </label>
      <input
        className="input mb-4"
        id="name"
        name="name"
        placeholder="Algorithms"
        required
      />

      {error && <p className="mb-4 text-sm text-[var(--danger)]">{error}</p>}

      <button className="btn btn-primary" disabled={loading} type="submit">
        {loading ? "Creating…" : "Create course"}
      </button>
    </form>
  );
}
