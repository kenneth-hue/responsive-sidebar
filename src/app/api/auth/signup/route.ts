import { NextResponse } from "next/server";
import { z } from "zod";
import { signupStaff } from "@/lib/db/repository";
import { createSessionToken, setSessionCookie } from "@/lib/auth/session";
import { isDemoMode } from "@/lib/config";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  full_name: z.string().min(2),
  role: z.enum(["lecturer", "ta"]),
});

export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());
    const { user } = await signupStaff(body);
    if (isDemoMode()) {
      const token = await createSessionToken(user);
      await setSessionCookie(token);
    }
    return NextResponse.json({ user });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Signup failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
