import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth/session";
import { isDemoMode } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  if (isDemoMode()) {
    await clearSessionCookie();
  } else {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  return NextResponse.json({ ok: true });
}
