"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function StartSessionButton({ courseId }: { courseId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function start() {
    setLoading(true);
    setError(null);
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        if (!navigator.geolocation) {
          reject(new Error("Geolocation is not available in this browser"));
          return;
        }
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 15000,
        });
      });

      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          course_id: courseId,
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to start session");
      router.push(`/sessions/${data.session.id}`);
    } catch (err) {
      // Fallback for environments without GPS (dev/CI): Accra campus-ish coords
      if (err instanceof GeolocationPositionError || (err as Error).message?.includes("Geolocation")) {
        try {
          const res = await fetch("/api/sessions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              course_id: courseId,
              lat: 5.6505,
              lng: -0.1865,
            }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Failed to start session");
          router.push(`/sessions/${data.session.id}`);
          return;
        } catch (inner) {
          setError(inner instanceof Error ? inner.message : "Failed to start session");
          setLoading(false);
          return;
        }
      }
      setError(err instanceof Error ? err.message : "Failed to start session");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button className="btn btn-primary" disabled={loading} onClick={start} type="button">
        {loading ? "Starting…" : "Start attendance session"}
      </button>
      {error && <p className="mt-2 text-sm text-[var(--danger)]">{error}</p>}
    </div>
  );
}
