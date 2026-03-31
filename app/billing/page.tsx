"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession, signIn } from "next-auth/react";

type SubData = {
  status: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  priceId: string;
} | null;

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

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; dot: string; desc: string }
> = {
  active: {
    label: "Active",
    color: "text-green-700 bg-green-50 border-green-200",
    dot: "bg-green-500",
    desc: "Your subscription is active and in good standing.",
  },
  trialing: {
    label: "Trial",
    color: "text-blue-700 bg-blue-50 border-blue-200",
    dot: "bg-blue-500",
    desc: "You are currently in a free trial period.",
  },
  past_due: {
    label: "Past Due",
    color: "text-amber-700 bg-amber-50 border-amber-200",
    dot: "bg-amber-500",
    desc: "Your last payment failed. Please update your payment method.",
  },
  canceled: {
    label: "Cancelled",
    color: "text-red-700 bg-red-50 border-red-200",
    dot: "bg-red-400",
    desc: "Your subscription has been cancelled.",
  },
  cancelled: {
    label: "Cancelled",
    color: "text-red-700 bg-red-50 border-red-200",
    dot: "bg-red-400",
    desc: "Your subscription has been cancelled.",
  },
  incomplete: {
    label: "Incomplete",
    color: "text-zinc-700 bg-zinc-50 border-zinc-200",
    dot: "bg-zinc-400",
    desc: "Your subscription setup is incomplete.",
  },
  pending: {
    label: "Pending",
    color: "text-zinc-700 bg-zinc-50 border-zinc-200",
    dot: "bg-zinc-400",
    desc: "Your subscription is being set up.",
  },
};

function fmtDate(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function Spinner() {
  return (
    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-700" />
  );
}

export default function BillingPage() {
  const { data: session, status: authStatus } = useSession();
  const [sub, setSub] = useState<SubData>(undefined as unknown as SubData);
  const [subLoading, setSubLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<null | "checkout" | "portal">(null);
  const [error, setError] = useState<string | null>(null);

  const email = session?.user?.email ?? "";

  useEffect(() => {
    if (authStatus !== "authenticated") return;
    fetch("/api/stripe/subscription")
      .then((r) => r.json())
      .then((d) => setSub(d.subscription ?? null))
      .catch(() => setSub(null))
      .finally(() => setSubLoading(false));
  }, [authStatus]);

  async function goCheckout() {
    setError(null);
    setActionLoading("checkout");
    try {
      const { url } = await postJson("/api/stripe/create-checkout-session");
      if (!url) throw new Error("No checkout url returned");
      window.location.href = url;
    } catch (err) {
      setError(getErrorMessage(err, "Checkout failed. Please try again."));
      setActionLoading(null);
    }
  }

  async function goPortal() {
    setError(null);
    setActionLoading("portal");
    try {
      const { url } = await postJson("/api/stripe/create-portal-session");
      if (!url) throw new Error("No portal url returned");
      window.location.href = url;
    } catch (err) {
      setError(getErrorMessage(err, "Could not open billing portal. Please try again."));
      setActionLoading(null);
    }
  }

  // Auth loading
  if (authStatus === "loading") {
    return (
      <div className="flex h-64 items-center justify-center gap-2 text-sm text-zinc-400">
        <Spinner /> Loading…
      </div>
    );
  }

  // Not signed in
  if (!session) {
    return (
      <main className="mx-auto w-full max-w-lg px-6 py-16">
        <div className="rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm text-center">
          <p className="text-sm text-zinc-600">You must be signed in to manage billing.</p>
          <button
            onClick={() => signIn(undefined, { callbackUrl: "/billing" })}
            className="mt-4 rounded-xl bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-800"
          >
            Sign in
          </button>
        </div>
      </main>
    );
  }

  const isActive = sub?.status === "active" || sub?.status === "trialing";
  const isPastDue = sub?.status === "past_due";
  const isCancelled = sub?.status === "canceled" || sub?.status === "cancelled";
  const statusInfo = sub ? (STATUS_CONFIG[sub.status] ?? STATUS_CONFIG["pending"]) : null;

  return (
    <main className="mx-auto w-full max-w-lg px-6 py-16">
      <h1 className="text-2xl font-bold text-zinc-900">Billing</h1>
      <p className="mt-1 text-sm text-zinc-500">Manage your subscription and payment details.</p>

      <div className="mt-8 space-y-4">
        {/* Account card */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3 border-b border-zinc-100 pb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 text-sm font-bold text-zinc-600">
              {email[0]?.toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-semibold text-zinc-900">{email}</p>
              <p className="text-xs text-zinc-400">Signed in</p>
            </div>
          </div>

          {/* Subscription status */}
          <div className="mt-5">
            {subLoading ? (
              <div className="flex items-center gap-2 text-sm text-zinc-400">
                <Spinner /> Checking subscription…
              </div>
            ) : sub && statusInfo ? (
              <div className="space-y-4">
                {/* Status badge */}
                <div className={`flex items-center gap-2 rounded-xl border px-4 py-3 ${statusInfo.color}`}>
                  <span className={`h-2 w-2 rounded-full ${statusInfo.dot}`} />
                  <div>
                    <p className="text-sm font-semibold">{statusInfo.label}</p>
                    <p className="text-xs opacity-80">{statusInfo.desc}</p>
                  </div>
                </div>

                {/* Period info */}
                {sub.currentPeriodEnd && (
                  <p className="text-xs text-zinc-400">
                    {sub.cancelAtPeriodEnd
                      ? `Access ends on ${fmtDate(sub.currentPeriodEnd)}`
                      : isActive
                      ? `Renews on ${fmtDate(sub.currentPeriodEnd)}`
                      : `Period ended ${fmtDate(sub.currentPeriodEnd)}`}
                  </p>
                )}

                {/* Actions based on status */}
                <div className="flex flex-wrap gap-3 pt-1">
                  {(isActive || isPastDue) && (
                    <button
                      onClick={goPortal}
                      disabled={actionLoading !== null}
                      className="rounded-xl border border-zinc-300 bg-white px-5 py-2.5 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-50"
                    >
                      {actionLoading === "portal" ? (
                        <span className="flex items-center gap-2"><Spinner /> Redirecting…</span>
                      ) : (
                        "Manage Subscription"
                      )}
                    </button>
                  )}

                  {(isCancelled || !isActive) && !isPastDue && (
                    <button
                      onClick={goCheckout}
                      disabled={actionLoading !== null}
                      className="rounded-xl bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-50"
                    >
                      {actionLoading === "checkout" ? (
                        <span className="flex items-center gap-2"><Spinner /> Redirecting…</span>
                      ) : (
                        "Subscribe Now"
                      )}
                    </button>
                  )}

                  {isPastDue && (
                    <button
                      onClick={goCheckout}
                      disabled={actionLoading !== null}
                      className="rounded-xl bg-amber-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-amber-700 disabled:opacity-50"
                    >
                      {actionLoading === "checkout" ? (
                        <span className="flex items-center gap-2"><Spinner /> Redirecting…</span>
                      ) : (
                        "Update Payment Method"
                      )}
                    </button>
                  )}
                </div>
              </div>
            ) : (
              /* No subscription yet */
              <div className="space-y-4">
                <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-4">
                  <p className="text-sm font-medium text-zinc-700">No active subscription</p>
                  <p className="mt-1 text-xs text-zinc-400">
                    Subscribe to get full access to all products and features.
                  </p>
                </div>
                <button
                  onClick={goCheckout}
                  disabled={actionLoading !== null}
                  className="w-full rounded-xl bg-zinc-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-50"
                >
                  {actionLoading === "checkout" ? (
                    <span className="flex items-center justify-center gap-2"><Spinner /> Redirecting…</span>
                  ) : (
                    "Subscribe Now"
                  )}
                </button>
              </div>
            )}
          </div>

          {error && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}
        </div>

        <div className="text-center">
          <Link
            href="/dashboard"
            className="text-sm text-zinc-400 transition hover:text-zinc-700"
          >
            ← Back to dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
