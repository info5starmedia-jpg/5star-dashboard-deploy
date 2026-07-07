import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

function envClean(key: string): string {
  return (process.env[key] || "").replace(/^["']|["']$/g, "").trim();
}

const isAdminRoute = (p: string) => p.startsWith("/admin") || p.startsWith("/api/admin");
const isDashboardRoute = (p: string) => p.startsWith("/dashboard");
const isBillingRoute = (p: string) => p.startsWith("/billing");

// Renamed from middleware() to proxy() for the Next.js 16 file convention.
// Behavior is unchanged; this now runs on the nodejs runtime instead of edge.
// Note: this is only the first of three auth layers — admin layouts and every
// /api/admin route independently re-verify the session, so a proxy-level bypass
// cannot by itself reach admin data.
export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/api/stripe/webhook")) return NextResponse.next();

  if (!isAdminRoute(pathname) && !isDashboardRoute(pathname) && !isBillingRoute(pathname)) {
    return NextResponse.next();
  }

  const secret = envClean("NEXTAUTH_SECRET") || envClean("AUTH_SECRET");
  const token = await getToken({ req, secret });

  if (!token) {
    const url = new URL("/signin", req.url);
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  const tokenFlags = token as typeof token & { isAdmin?: boolean; isSubscriber?: boolean };

  if (isAdminRoute(pathname) && !tokenFlags.isAdmin) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  // All authenticated users can access the dashboard (products + orders visible to everyone)
  // Billing gate is only enforced for admin-only features if needed in the future

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/dashboard/:path*", "/billing", "/api/admin/:path*"],
};
