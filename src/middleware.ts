import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/config";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isStaffArea =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/courses") ||
    pathname.startsWith("/sessions");

  if (!isStaffArea) return NextResponse.next();

  const demoSession = request.cookies.get(SESSION_COOKIE)?.value;
  const hasSupabaseAuth = request.cookies
    .getAll()
    .some((c) => c.name.includes("auth-token") || c.name.startsWith("sb-"));

  if (!demoSession && !hasSupabaseAuth) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/courses/:path*", "/sessions/:path*"],
};
