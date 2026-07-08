import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Link from "next/link";

export default async function HomePage() {
  const session = await getServerSession(authOptions);

  // Signed-in users go straight to the dashboard — no reason to linger on home
  if (session?.user?.email) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-6 py-16">
      <main className="flex w-full max-w-md flex-col gap-6 rounded-2xl border border-orange-400/30 bg-zinc-900 p-10 shadow-sm">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-orange-400">
            Viking Essentials
          </p>
          <h1 className="text-3xl font-bold leading-tight text-white">
            Welcome
          </h1>
          <p className="text-sm text-zinc-400">
            Sign in to access your products and order history.
          </p>
        </div>

        <Link
          href="/signin"
          className="inline-flex items-center justify-center rounded-xl bg-orange-500 px-5 py-3 text-sm font-semibold text-black transition hover:bg-orange-400"
        >
          Sign in to get started
        </Link>
      </main>
    </div>
  );
}
