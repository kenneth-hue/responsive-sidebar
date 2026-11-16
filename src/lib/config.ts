export function isDemoMode(): boolean {
  if (process.env.ATTENDANCE_DEMO_MODE === "true") return true;
  if (process.env.ATTENDANCE_DEMO_MODE === "false") return false;
  // Default to demo when Supabase is not configured so the app is runnable locally.
  return !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
}

export function getQrSecret(): string {
  return process.env.QR_HMAC_SECRET || "dev-qr-hmac-secret-change-me";
}

export function getAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}

export const FACE_EMBEDDING_SIZE = 128;
export const FACE_MATCH_THRESHOLD = 0.82;
export const QR_TTL_SECONDS = 30;
export const QR_ROTATE_MS = 12_000;
export const DEFAULT_RADIUS_M = 100;
export const DEVICE_COOKIE = "presence_device_id";
export const SESSION_COOKIE = "presence_session";
