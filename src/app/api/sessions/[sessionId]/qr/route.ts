import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { requireStaff } from "@/lib/auth/current-user";
import { assertCourseStaff, getSession } from "@/lib/db/repository";
import { createQrToken } from "@/lib/qr/token";
import { getAppUrl, QR_TTL_SECONDS } from "@/lib/config";

export async function GET(
  _request: Request,
  context: { params: Promise<{ sessionId: string }> },
) {
  try {
    const user = await requireStaff();
    const { sessionId } = await context.params;
    const session = await getSession(sessionId);
    if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await assertCourseStaff(session.course_id, user.id);

    if (session.status !== "active") {
      return NextResponse.json({ error: "Session is not active" }, { status: 400 });
    }

    if (session.ends_at && new Date(session.ends_at).getTime() < Date.now()) {
      return NextResponse.json({ error: "Session time has ended" }, { status: 400 });
    }

    const token = createQrToken(sessionId, QR_TTL_SECONDS);
    const checkInUrl = `${getAppUrl()}/c/${encodeURIComponent(token)}`;
    const qrDataUrl = await QRCode.toDataURL(checkInUrl, {
      margin: 1,
      width: 512,
      errorCorrectionLevel: "M",
    });

    return NextResponse.json({
      token,
      url: checkInUrl,
      qrDataUrl,
      expiresIn: QR_TTL_SECONDS,
      issuedAt: Math.floor(Date.now() / 1000),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
