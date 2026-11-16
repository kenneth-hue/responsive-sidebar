import { CheckInClient } from "@/components/checkin/CheckInClient";
import { verifyQrToken } from "@/lib/qr/token";
import { getSession } from "@/lib/db/repository";

export default async function CheckInPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token: raw } = await params;
  const token = decodeURIComponent(raw);
  const verified = verifyQrToken(token);

  if (!verified.ok) {
    return (
      <div className="mx-auto flex min-h-screen max-w-lg items-center px-4 py-12">
        <div className="panel w-full rounded-2xl p-6">
          <h1
            className="text-3xl font-semibold"
            style={{ fontFamily: "var(--font-display), serif" }}
          >
            Presence
          </h1>
          <p className="mt-3 text-[var(--danger)]">{verified.error}</p>
          <p className="mt-2 text-sm text-[var(--ink-muted)]">
            Ask your lecturer to show a fresh QR code and scan again.
          </p>
        </div>
      </div>
    );
  }

  const session = await getSession(verified.payload.session_id);
  if (!session || session.status !== "active") {
    return (
      <div className="mx-auto flex min-h-screen max-w-lg items-center px-4 py-12">
        <div className="panel w-full rounded-2xl p-6">
          <h1
            className="text-3xl font-semibold"
            style={{ fontFamily: "var(--font-display), serif" }}
          >
            Presence
          </h1>
          <p className="mt-3 text-[var(--danger)]">This attendance session is not active.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-lg items-center px-4 py-12">
      <CheckInClient token={token} />
    </div>
  );
}
