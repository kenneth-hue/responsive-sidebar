import { isDemoMode } from "@/lib/config";
import { readSessionUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { StaffUser } from "@/lib/types";

export async function getCurrentStaff(): Promise<StaffUser | null> {
  if (isDemoMode()) {
    return readSessionUser();
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", data.user.id)
    .single();

  return {
    id: data.user.id,
    email: data.user.email ?? "",
    full_name: profile?.full_name ?? data.user.user_metadata?.full_name ?? "Staff",
    role: profile?.role ?? data.user.user_metadata?.role ?? "lecturer",
  };
}

export async function requireStaff(): Promise<StaffUser> {
  const user = await getCurrentStaff();
  if (!user) {
    throw new Error("Unauthorized");
  }
  return user;
}
