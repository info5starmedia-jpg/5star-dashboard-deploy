import type { Metadata } from "next";
import Link from "next/link";
import { getServerSession } from "next-auth";

import Providers from "./providers";
import { authOptions } from "@/lib/auth";
import { OWNER_EMAIL } from "@/lib/constants";
import SignOutButton from "@/components/SignOutButton";
import "./globals.css";

export const metadata: Metadata = {
  title: "5star Dashboard",
  description: "Session-aware dashboard experience",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  const userEmail = session?.user?.email ?? null;
  const role = (session?.user as { role?: string } | undefined)?.role ?? "user";
  const isAdmin = role === "admin" || userEmail === OWNER_EMAIL;

  return (
    <html lang="en">
      <body className="min-h-screen bg-zinc-50 font-sans text-zinc-900 antialiased">
        <Providers>
          <div className="flex min-h-screen flex-col">
            <header className="border-b border-zinc-200 bg-white shadow-sm">
              <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
                {/* Brand */}
                <div className="flex items-center gap-6">
                  <Link className="text-lg font-bold text-zinc-900" href="/">
                    5star
                  </Link>

                  {/* Nav — only show when signed in */}
                  {userEmail && (
                    <nav className="flex items-center gap-1 text-sm">
                      <Link
                        className="rounded-md px-3 py-1.5 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 transition"
                        href="/dashboard"
                      >
                        Dashboard
                      </Link>
                      <Link
                        className="rounded-md px-3 py-1.5 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 transition"
                        href="/billing"
                      >
                        Billing
                      </Link>
                      {isAdmin && (
                        <Link
                          className="rounded-md px-3 py-1.5 text-blue-600 hover:bg-blue-50 hover:text-blue-800 transition font-medium"
                          href="/admin"
                        >
                          Admin
                        </Link>
                      )}
                    </nav>
                  )}
                </div>

                {/* Right side */}
                <div className="flex items-center gap-3 text-sm">
                  {userEmail ? (
                    <>
                      <span className="hidden text-zinc-500 sm:inline text-xs">{userEmail}</span>
                      <SignOutButton />
                    </>
                  ) : (
                    <Link
                      className="rounded-md bg-zinc-900 px-3 py-1.5 font-medium text-white transition hover:bg-zinc-800"
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
