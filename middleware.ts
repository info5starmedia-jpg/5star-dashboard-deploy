import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

const isAdminRoute = (p: string) => p.startsWith("/admin") || p.startsWith("/api/admin");
const isDashboardRoute = (p: string) => p.startsWith("/dashboard");
const isBillingRoute = (p: string) => p.startsWith("/billing");

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/api/stripe/webhook")) return NextResponse.next();

  if (!isAdminRoute(pathname) && !isDashboardRoute(pathname) && !isBillingRoute(pathname)) {
    return NextResponse.next();
  }

  const token = await getToken({ req });

  if (!token) {
    const url = new URL("/api/auth/signin", req.url);
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  const tokenFlags = token as typeof token & { isAdmin?: boolean; isSubscriber?: boolean };

  if (isAdminRoute(pathname) && !tokenFlags.isAdmin) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  if (isDashboardRoute(pathname) && !(tokenFlags.isAdmin || tokenFlags.isSubscriber)) {
    return NextResponse.redirect(new URL("/billing", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/dashboard/:path*", "/billing", "/api/admin/:path*"],
};
