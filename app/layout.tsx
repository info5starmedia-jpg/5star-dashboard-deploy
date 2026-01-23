import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import { getServerSession } from "next-auth";

import Providers from "./providers";
import { authOptions } from "@/lib/auth";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

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
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen bg-zinc-50 text-zinc-900 antialiased`}
      >
        <Providers>
          <div className="flex min-h-screen flex-col">
            <header className="border-b border-zinc-200 bg-white">
              <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
                <div className="flex items-center gap-6">
                  <Link className="text-lg font-semibold" href="/">
                    5star
                  </Link>
                  <nav className="flex items-center gap-4 text-sm text-zinc-600">
                    <Link className="hover:text-zinc-900" href="/">
                      Home
                    </Link>
                    <Link className="hover:text-zinc-900" href="/dashboard">
                      Dashboard
                    </Link>
                    <Link className="hover:text-zinc-900" href="/billing">
                      Billing
                    </Link>
                  </nav>
                </div>

                <div className="flex items-center gap-3 text-sm">
                  {session?.user ? (
                    <>
                      <span className="hidden text-zinc-600 sm:inline">
                        {session.user.email}
                      </span>
                      <form action="/api/auth/signout" method="post">
                        <button
                          className="rounded-md border border-zinc-300 px-3 py-1.5 font-medium text-zinc-700 transition hover:border-zinc-400 hover:text-zinc-900"
                          type="submit"
                        >
                          Sign out
                        </button>
                      </form>
                    </>
                  ) : (
                    <a
                      className="rounded-md bg-zinc-900 px-3 py-1.5 font-medium text-white transition hover:bg-zinc-800"
                      href="/api/auth/signin"
                    >
                      Sign in
                    </a>
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
