"use client";

import { useState } from "react";
import Link from "next/link";
import { useSession, signIn } from "next-auth/react";

async function postJson(path: string) {
  const res = await fetch(path, { method: "POST" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
  return data;
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return fallback;
}

export default function BillingPage() {
  const { data: session, status } = useSession();
  const [loading, setLoading] = useState<null | "checkout" | "portal">(null);
  const [error, setError] = useState<string | null>(null);

  const email = session?.user?.email || "";

  async function goCheckout() {
    setError(null);
    setLoading("checkout");
    try {
      const { url } = await postJson("/api/stripe/create-checkout-session");
      if (!url) throw new Error("No checkout url returned");
      window.location.href = url;
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Checkout failed"));
      setLoading(null);
    }
  }

  async function goPortal() {
    setError(null);
    setLoading("portal");
    try {
      const { url } = await postJson("/api/stripe/create-portal-session");
      if (!url) throw new Error("No portal url returned");
      window.location.href = url;
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Portal failed"));
      setLoading(null);
    }
  }

  return (
    <main className="mx-auto w-full max-w-lg px-6 py-16">
      <h1 className="text-2xl font-bold text-zinc-900">Billing</h1>
      <p className="mt-2 text-sm text-zinc-500">Manage your subscription and payment details.</p>

      <div className="mt-8">
        {status === "loading" ? (
          <div className="flex items-center gap-2 text-sm text-zinc-400">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-200 border-t-zinc-600" />
            Loading...
          </div>

        ) : !session ? (
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <p className="text-sm text-zinc-600">You must be signed in to manage billing.</p>
            <button
              onClick={() => signIn(undefined, { callbackUrl: "/billing" })}
              className="mt-4 rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-800"
            >
              Sign in
            </button>
          </div>

        ) : (
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3 border-b border-zinc-100 pb-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-100 text-sm font-semibold text-zinc-600">
                {email[0]?.toUpperCase()}
              </div>
              <div>
                <div className="text-sm font-medium text-zinc-900">{email}</div>
                <div className="text-xs text-zinc-400">Signed in</div>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                onClick={goCheckout}
                disabled={loading !== null}
                className="rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-50"
              >
                {loading === "checkout" ? "Redirecting..." : "Subscribe"}
              </button>
              <button
                onClick={goPortal}
                disabled={loading !== null}
                className="rounded-lg border border-zinc-300 bg-white px-5 py-2.5 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-50"
              >
                {loading === "portal" ? "Redirecting..." : "Manage subscription"}
              </button>
            </div>

            {error && (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="mt-5 border-t border-zinc-100 pt-4">
              <Link href="/dashboard" className="text-sm text-zinc-400 transition hover:text-zinc-700">
                &larr; Back to dashboard
              </Link>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
