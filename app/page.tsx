import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export default async function HomePage() {
  const session = await getServerSession(authOptions);

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-6 py-16 text-zinc-900">
      <main className="flex w-full max-w-2xl flex-col gap-6 rounded-2xl border border-zinc-200 bg-white p-10 shadow-sm">
        <div className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
            5star dashboard
          </p>
          <h1 className="text-3xl font-semibold leading-tight">
            Session-aware home
          </h1>
          <p className="text-base text-zinc-600">
            Continue to your dashboard once you&apos;re authenticated.
          </p>
        </div>

        {session?.user ? (
          <div className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-sm text-emerald-900">
              Signed in as{" "}
              <span className="font-semibold">{session.user.email}</span>
            </p>
            <Link
              className="inline-flex items-center justify-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700"
              href="/dashboard"
            >
              Go to dashboard
            </Link>
          </div>
        ) : (
          <div className="space-y-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
            <p className="text-sm text-zinc-600">You&apos;re not signed in yet.</p>
            <a
              className="inline-flex items-center justify-center rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800"
              href="/api/auth/signin"
            >
              Sign in
            </a>
          </div>
        )}
      </main>
    </div>
  );
}
