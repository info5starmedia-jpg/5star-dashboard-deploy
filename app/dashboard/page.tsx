import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { OWNER_EMAIL } from "@/lib/constants";
import SignOutButton from "@/components/SignOutButton";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/signin");

  const role = (session.user as any).role ?? "user";
  const isAdmin = role === "admin" || session.user.email === OWNER_EMAIL;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-6 py-12">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
            Dashboard
          </p>
          <h1 className="text-3xl font-semibold text-zinc-900">Welcome back</h1>
          <p className="mt-2 text-zinc-600">
            You&apos;re signed in as <span className="font-medium">{session.user.email}</span>{" "}
            <span className="ml-2 rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700">
              {role}
            </span>
          </p>
        </div>

        <div className="flex gap-2">
          <Link
            href="/"
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-medium shadow-sm hover:bg-zinc-50"
          >
            Home
          </Link>

          {isAdmin && (
            <Link
              href="/admin"
              className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-medium shadow-sm hover:bg-zinc-50"
            >
              Admin
            </Link>
          )}

          <SignOutButton />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-zinc-900">Account overview</h2>
          <p className="mt-2 text-sm text-zinc-600">
            Subscription, billing, and delivery settings will live here.
          </p>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-zinc-900">Latest activity</h2>
          <p className="mt-2 text-sm text-zinc-600">
            Audit logs and fulfillment updates will appear here.
          </p>
        </div>
      </div>
    </div>
  );
}
