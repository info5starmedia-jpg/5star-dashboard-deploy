import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

function envClean(key: string): string {
  return (process.env[key] || "").replace(/^["']|["']$/g, "").trim();
}

const isAdminRoute = (p: string) => p.startsWith("/admin") || p.startsWith("/api/admin");
const isDashboardRoute = (p: string) => p.startsWith("/dashboard");
const isBillingRoute = (p: string) => p.startsWith("/billing");

export async function middleware(req: NextRequest) {
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
