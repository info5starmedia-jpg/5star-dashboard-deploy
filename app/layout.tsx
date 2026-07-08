import type { Metadata } from "next";
import Link from "next/link";
import { getServerSession } from "next-auth";

import Providers from "./providers";
import { authOptions } from "@/lib/auth";
import { OWNER_EMAIL } from "@/lib/constants";
import SignOutButton from "@/components/SignOutButton";
import "./globals.css";

export const metadata: Metadata = {
  title: "Viking Essentials",
  description: "Viking Essentials Dashboard",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  const userEmail = session?.user?.email ?? null;
  const sessionUser = session?.user as { isAdmin?: boolean; isPromoter?: boolean } | null;

  // isAdmin: JWT flag (set from DB role) OR hardcoded owner email
  const isAdmin = sessionUser?.isAdmin === true || userEmail === OWNER_EMAIL;
  const isPromoter = sessionUser?.isPromoter === true;

  return (
    <html lang="en">
      <body className="min-h-screen bg-zinc-50 font-sans text-zinc-900 antialiased">
        <Providers>
          <div className="flex min-h-screen flex-col">
            <header className="border-b border-orange-300 bg-orange-100 shadow-sm">
              <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
                <div className="flex items-center gap-6">
                  <Link className="text-xl font-extrabold text-black tracking-tight" href="/">
                    Viking Essentials
                  </Link>
                  {userEmail && (
                    <nav className="flex items-center gap-1 text-sm">
                      <Link
                        className="rounded-md px-3 py-1.5 font-bold text-black hover:bg-orange-200 transition"
                        href="/dashboard"
                      >
                        Dashboard
                      </Link>
                      {isAdmin && (
                        <Link
                          className="rounded-md px-3 py-1.5 font-bold text-black hover:bg-orange-200 transition"
                          href="/admin"
                        >
                          Admin
                        </Link>
                      )}
                      {isPromoter && !isAdmin && (
                        <Link
                          className="rounded-md px-3 py-1.5 font-bold text-black hover:bg-orange-200 transition"
                          href="/dashboard/promo"
                        >
                          Coupons
                        </Link>
                      )}
                    </nav>
                  )}
                </div>
                <div className="flex items-center gap-3 text-sm">
                  {userEmail ? (
                    <>
                      <span className="hidden sm:inline text-sm font-bold text-black">{userEmail}</span>
                      <SignOutButton />
                    </>
                  ) : (
                    <Link
                      className="rounded-md bg-black px-3 py-1.5 font-bold text-white transition hover:bg-zinc-800"
                      href="/signin"
                    >
                      Sign in
                    </Link>
                  )}
                </div>
              </div>
            </header>
            <main className="flex-1">{children}</main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
