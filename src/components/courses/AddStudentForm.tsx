"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function AddStudentForm({ courseId }: { courseId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    const res = await fetch(`/api/courses/${courseId}/students`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        index_number: form.get("index_number"),
        full_name: form.get("full_name"),
      }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "Failed to add student");
      return;
    }
    (e.target as HTMLFormElement).reset();
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="panel rounded-2xl p-5">
      <h2 className="mb-3 text-lg font-semibold">Add student</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="index_number">
            Index number
          </label>
          <input className="input" id="index_number" name="index_number" required />
        </div>
        <div>
          <label className="label" htmlFor="full_name">
            Full name
          </label>
          <input className="input" id="full_name" name="full_name" required />
        </div>
      </div>
      {error && <p className="mt-3 text-sm text-[var(--danger)]">{error}</p>}
      <button className="btn btn-primary mt-4" disabled={loading} type="submit">
        {loading ? "Adding…" : "Add to roster"}
      </button>
    </form>
  );
}
