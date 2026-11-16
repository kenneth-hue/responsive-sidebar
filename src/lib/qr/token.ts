import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { getQrSecret, QR_TTL_SECONDS } from "@/lib/config";

export interface QrPayload {
  session_id: string;
  nonce: string;
  iat: number;
  exp: number;
}

function b64url(input: Buffer | string): string {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return buf.toString("base64url");
}

function sign(data: string): string {
  return createHmac("sha256", getQrSecret()).update(data).digest("base64url");
}

export function createQrToken(sessionId: string, ttlSeconds = QR_TTL_SECONDS): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: QrPayload = {
    session_id: sessionId,
    nonce: randomBytes(8).toString("hex"),
    iat: now,
    exp: now + ttlSeconds,
  };
  const body = b64url(JSON.stringify(payload));
  const sig = sign(body);
  return `${body}.${sig}`;
}

export function verifyQrToken(token: string):
  | { ok: true; payload: QrPayload }
  | { ok: false; error: string } {
  const parts = token.split(".");
  if (parts.length !== 2) return { ok: false, error: "Malformed QR token" };

  const [body, sig] = parts;
  const expected = sign(body);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, error: "Invalid QR signature" };
  }

  let payload: QrPayload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as QrPayload;
  } catch {
    return { ok: false, error: "Invalid QR payload" };
  }

  if (!payload.session_id || !payload.exp || !payload.iat) {
    return { ok: false, error: "Incomplete QR payload" };
  }

  if (payload.exp - payload.iat > QR_TTL_SECONDS + 1) {
    return { ok: false, error: "QR token TTL exceeds 30 seconds" };
  }

  const now = Math.floor(Date.now() / 1000);
  if (now > payload.exp) {
    return { ok: false, error: "QR code expired — please rescan" };
  }

  return { ok: true, payload };
}
