import type { Metadata } from "next";
import Link from "next/link";
import { getServerSession } from "next-auth";

import Providers from "./providers";
import { authOptions } from "@/lib/auth";
import SignOutButton from "@/components/SignOutButton";
import "./globals.css";

// next/font/google downloads fonts at build time and requires outbound network
// access during `npm run build`. To keep Docker builds reliable in restricted
// environments we use the Tailwind system-font stack instead (no network call).

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

  return (
    <html lang="en">
      <body className="min-h-screen bg-zinc-50 font-sans text-zinc-900 antialiased">
        <Providers>
          <div className="flex min-h-screen flex-col">
            <header className="border-b border-zinc-200 bg-white">
              <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
                <div className="flex items-center gap-6">
                  <Link className="text-lg font-semibold" href="/">
                    5star
                  </Link>
                  <nav className="flex items-center gap-4 text-sm text-zinc-600">
                    <Link className="hover:text-zinc-900" href="/">Home</Link>
                    <Link className="hover:text-zinc-900" href="/dashboard">Dashboard</Link>
                    <Link className="hover:text-zinc-900" href="/billing">Billing</Link>
                  </nav>
                </div>

                <div className="flex items-center gap-3 text-sm">
                  {session?.user ? (
                    <>
                      <span className="hidden text-zinc-600 sm:inline">
                        {session.user.email}
                      </span>
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
