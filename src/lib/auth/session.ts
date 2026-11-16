import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { SESSION_COOKIE, isDemoMode } from "@/lib/config";
import type { StaffRole, StaffUser } from "@/lib/types";

function secretKey() {
  return new TextEncoder().encode(
    process.env.SESSION_SECRET || process.env.QR_HMAC_SECRET || "dev-session-secret",
  );
}

export async function createSessionToken(user: StaffUser): Promise<string> {
  return new SignJWT({
    email: user.email,
    full_name: user.full_name,
    role: user.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secretKey());
}

export async function readSessionUser(): Promise<StaffUser | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (!payload.sub) return null;
    return {
      id: payload.sub,
      email: String(payload.email ?? ""),
      full_name: String(payload.full_name ?? ""),
      role: (payload.role as StaffRole) ?? "lecturer",
    };
  } catch {
    return null;
  }
}

export async function setSessionCookie(token: string) {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

export async function requireStaffUser(): Promise<StaffUser> {
  if (!isDemoMode()) {
    // Supabase path uses middleware + getUser; demo uses signed cookie.
  }
  const user = await readSessionUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}
