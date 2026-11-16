/**
 * Server-side liveness gate.
 * Client must send a signed-style liveness payload proving motion across frames.
 * We never store video — only a compact motion score + challenge nonce.
 */

export interface LivenessPayload {
  challengeId: string;
  motionScore: number;
  frameCount: number;
  completedAt: number;
}

const MIN_MOTION = 0.04;
const MIN_FRAMES = 8;
const MAX_AGE_MS = 60_000;

export function verifyLiveness(payload: LivenessPayload | null | undefined): {
  ok: boolean;
  error?: string;
} {
  if (!payload) return { ok: false, error: "Liveness check required" };
  if (!payload.challengeId || payload.challengeId.length < 8) {
    return { ok: false, error: "Invalid liveness challenge" };
  }
  if (payload.frameCount < MIN_FRAMES) {
    return { ok: false, error: "Liveness failed: not enough motion samples" };
  }
  if (payload.motionScore < MIN_MOTION) {
    return { ok: false, error: "Liveness failed: no live motion detected" };
  }
  if (Date.now() - payload.completedAt > MAX_AGE_MS) {
    return { ok: false, error: "Liveness challenge expired — try again" };
  }
  return { ok: true };
}
