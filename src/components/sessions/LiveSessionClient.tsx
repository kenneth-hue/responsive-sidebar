"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { QR_ROTATE_MS } from "@/lib/config.client";
import type { AttendanceRecord, Session } from "@/lib/types";

export function LiveSessionClient({
  session: initial,
}: {
  session: Session;
}) {
  const router = useRouter();
  const [session, setSession] = useState(initial);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [expiresIn, setExpiresIn] = useState(30);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ending, setEnding] = useState(false);

  const refreshQr = useCallback(async () => {
    if (session.status !== "active") return;
    const res = await fetch(`/api/sessions/${session.id}/qr`);
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Could not refresh QR");
      return;
    }
    setQrDataUrl(data.qrDataUrl);
    setExpiresIn(data.expiresIn);
    setError(null);
  }, [session.id, session.status]);

  const refreshAttendance = useCallback(async () => {
    const res = await fetch(`/api/sessions/${session.id}/attendance`);
    const data = await res.json();
    if (res.ok) {
      setAttendance(data.attendance);
      setSession(data.session);
    }
  }, [session.id]);

  useEffect(() => {
    refreshQr();
    refreshAttendance();
    const qrTimer = setInterval(refreshQr, QR_ROTATE_MS);
    const attTimer = setInterval(refreshAttendance, 5000);
    return () => {
      clearInterval(qrTimer);
      clearInterval(attTimer);
    };
  }, [refreshQr, refreshAttendance]);

  async function endSession() {
    setEnding(true);
    const res = await fetch(`/api/sessions/${session.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "end" }),
    });
    const data = await res.json();
    setEnding(false);
    if (!res.ok) {
      setError(data.error || "Could not end session");
      return;
    }
    setSession(data.session);
    router.refresh();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <section className="panel fade-up rounded-2xl p-6 text-center">
        <div className="mb-4 flex items-center justify-center gap-2 text-sm font-semibold uppercase tracking-wide">
          {session.status === "active" ? (
            <>
              <span className="live-dot" /> Live session
            </>
          ) : (
            <span>Session ended</span>
          )}
        </div>

        {session.status === "active" && qrDataUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qrDataUrl}
              alt="Attendance QR code"
              className="mx-auto w-full max-w-md rounded-xl bg-white p-3 shadow-sm"
            />
            <p className="mt-4 text-sm text-[var(--ink-muted)]">
              Rotating signed QR · tokens expire in {expiresIn}s · refresh every{" "}
              {Math.round(QR_ROTATE_MS / 1000)}s
            </p>
          </>
        ) : (
          <p className="py-16 text-[var(--ink-muted)]">
            {session.status === "ended"
              ? "QR codes are disabled after the session ends."
              : "Loading QR…"}
          </p>
        )}

        {error && <p className="mt-3 text-sm text-[var(--danger)]">{error}</p>}

        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {session.status === "active" && (
            <button className="btn btn-danger" disabled={ending} type="button" onClick={endSession}>
              {ending ? "Ending…" : "End session"}
            </button>
          )}
          <a className="btn btn-secondary" href={`/api/sessions/${session.id}/csv`}>
            Download CSV
          </a>
        </div>

        <p className="mt-4 text-xs text-[var(--ink-muted)]">
          Classroom pin: {session.lat.toFixed(5)}, {session.lng.toFixed(5)} · radius{" "}
          {session.radius_m}m
        </p>
      </section>

      <section className="panel fade-up rounded-2xl p-5">
        <h2 className="mb-3 text-xl font-semibold">
          Check-ins ({attendance.length})
        </h2>
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Index</th>
                <th>Name</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {attendance.map((row) => (
                <tr key={row.id}>
                  <td>{row.index_number}</td>
                  <td>{row.full_name}</td>
                  <td>{new Date(row.checked_in_at).toLocaleTimeString()}</td>
                </tr>
              ))}
              {attendance.length === 0 && (
                <tr>
                  <td colSpan={3} className="text-[var(--ink-muted)]">
                    Waiting for students…
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
