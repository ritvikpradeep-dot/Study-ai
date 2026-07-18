import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/auth";

const PROTECTED_PREFIXES = ["/dashboard", "/documents", "/teams", "/admin"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  // /admin/login is the admin sign-in page itself — it must stay reachable
  // by logged-out users and by logged-in non-admins (who need to see the
  // "not an admin account" rejection rather than being bounced away first).
  if (pathname === "/admin/login") return NextResponse.next();

  const isProtected = PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  if (!isProtected) return NextResponse.next();

  const session = await auth();
  if (!session?.user) {
    const loginUrl = new URL(pathname.startsWith("/admin") ? "/admin/login" : "/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname.startsWith("/admin") && session.user.role !== "ADMIN") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/documents/:path*", "/teams/:path*", "/admin/:path*"],
};
