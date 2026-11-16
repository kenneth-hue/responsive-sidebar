import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomUUID } from "crypto";
import { z } from "zod";
import { DEVICE_COOKIE, FACE_MATCH_THRESHOLD } from "@/lib/config";
import { verifyQrToken } from "@/lib/qr/token";
import { verifyLiveness } from "@/lib/face/liveness";
import { cosineSimilarity, extractFaceEmbedding } from "@/lib/face/embedding";
import { withinRadius } from "@/lib/geo/haversine";
import { hashDeviceId } from "@/lib/device";
import {
  findStudentByIndex,
  getFaceEmbedding,
  getSession,
  recordAttendance,
} from "@/lib/db/repository";

const livenessSchema = z.object({
  challengeId: z.string().min(8),
  motionScore: z.number(),
  frameCount: z.number().int(),
  completedAt: z.number(),
});

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const token = String(form.get("token") ?? "");
    const indexNumber = String(form.get("index_number") ?? "");
    const lat = Number(form.get("lat"));
    const lng = Number(form.get("lng"));
    const livenessRaw = String(form.get("liveness") ?? "");
    const image = form.get("image");

    const qr = verifyQrToken(token);
    if (!qr.ok) {
      return NextResponse.json({ error: qr.error, code: "QR_INVALID" }, { status: 400 });
    }

    const session = await getSession(qr.payload.session_id);
    if (!session) {
      return NextResponse.json({ error: "Session not found", code: "SESSION_MISSING" }, { status: 404 });
    }
    if (session.status !== "active") {
      return NextResponse.json({ error: "Session has ended", code: "SESSION_ENDED" }, { status: 400 });
    }
    if (session.ends_at && new Date(session.ends_at).getTime() < Date.now()) {
      return NextResponse.json({ error: "Session time has ended", code: "SESSION_ENDED" }, { status: 400 });
    }

    if (!indexNumber.trim()) {
      return NextResponse.json({ error: "Index number required", code: "INDEX_REQUIRED" }, { status: 400 });
    }
    if (!(image instanceof File)) {
      return NextResponse.json({ error: "Face capture required", code: "FACE_REQUIRED" }, { status: 400 });
    }
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return NextResponse.json({ error: "Location required", code: "LOCATION_REQUIRED" }, { status: 400 });
    }

    let livenessPayload;
    try {
      livenessPayload = livenessSchema.parse(JSON.parse(livenessRaw));
    } catch {
      return NextResponse.json({ error: "Invalid liveness payload", code: "LIVENESS_INVALID" }, { status: 400 });
    }
    const liveness = verifyLiveness(livenessPayload);
    if (!liveness.ok) {
      return NextResponse.json({ error: liveness.error, code: "LIVENESS_FAILED" }, { status: 400 });
    }

    const geo = withinRadius(session.lat, session.lng, lat, lng, session.radius_m);
    if (!geo.ok) {
      return NextResponse.json(
        {
          error: `Too far from classroom (${Math.round(geo.distanceM)}m > ${session.radius_m}m)`,
          code: "LOCATION_FAILED",
          distance_m: Math.round(geo.distanceM),
        },
        { status: 400 },
      );
    }

    const student = await findStudentByIndex(indexNumber);
    if (!student) {
      return NextResponse.json({ error: "Unknown index number", code: "STUDENT_UNKNOWN" }, { status: 404 });
    }

    const stored = await getFaceEmbedding(student.id);
    if (!stored) {
      return NextResponse.json(
        { error: "No enrolled face for this index number", code: "FACE_NOT_ENROLLED" },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await image.arrayBuffer());
    const captureEmbedding = await extractFaceEmbedding(buffer);
    // Capture discarded after embedding — never stored.
    const score = cosineSimilarity(captureEmbedding, stored.embedding);
    if (score < FACE_MATCH_THRESHOLD) {
      return NextResponse.json(
        {
          error: "Face does not match enrolled face for this index number",
          code: "FACE_MISMATCH",
          score: Number(score.toFixed(3)),
        },
        { status: 400 },
      );
    }

    const jar = await cookies();
    let deviceId = jar.get(DEVICE_COOKIE)?.value;
    if (!deviceId) {
      deviceId = randomUUID();
    }
    const device_hash = hashDeviceId(deviceId);

    try {
      const record = await recordAttendance({
        session_id: session.id,
        student_id: student.id,
        device_hash,
      });

      const response = NextResponse.json({
        ok: true,
        checked_in_at: record.checked_in_at,
        index_number: student.index_number,
        full_name: student.full_name,
        match_score: Number(score.toFixed(3)),
        distance_m: Math.round(geo.distanceM),
      });
      response.cookies.set(DEVICE_COOKIE, deviceId, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
      });
      return response;
    } catch (err) {
      const code = (err as { code?: string }).code;
      const message = err instanceof Error ? err.message : "Check-in failed";
      if (code === "DUPLICATE_INDEX" || code === "DUPLICATE_DEVICE") {
        return NextResponse.json({ error: message, code }, { status: 409 });
      }
      throw err;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Check-in failed";
    return NextResponse.json({ error: message, code: "CHECKIN_FAILED" }, { status: 500 });
  }
}
