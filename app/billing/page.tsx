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
    } catch (e: any) {
      setError(e?.message || "Checkout failed");
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
    } catch (e: any) {
      setError(e?.message || "Portal failed");
      setLoading(null);
    }
  }

  return (
    <main style={{ maxWidth: 760, margin: "40px auto", padding: "0 16px" }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Billing</h1>
      <p style={{ marginBottom: 20, opacity: 0.85 }}>
        Subscribe to unlock the dashboard features.
      </p>

      {status === "loading" ? (
        <p>Loading…</p>
      ) : !session ? (
        <div style={{ padding: 16, border: "1px solid #333", borderRadius: 10 }}>
          <p style={{ marginBottom: 12 }}>You must be signed in to manage billing.</p>
          <button
            onClick={() => signIn(undefined, { callbackUrl: "/billing" })}
            style={{ padding: "10px 14px", borderRadius: 10, cursor: "pointer" }}
            >
            Sign in
          </button>
        </div>
      ) : (
        <div style={{ padding: 16, border: "1px solid #333", borderRadius: 10 }}>
          <p style={{ marginBottom: 12 }}>
            Signed in as <b>{email}</b>
          </p>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <button
              onClick={goCheckout}
              disabled={loading !== null}
              style={{ padding: "10px 14px", borderRadius: 10, cursor: "pointer" }}
            >
              {loading === "checkout" ? "Redirecting…" : "Subscribe"}
            </button>

            <button
              onClick={goPortal}
              disabled={loading !== null}
              style={{ padding: "10px 14px", borderRadius: 10, cursor: "pointer" }}
            >
              {loading === "portal" ? "Redirecting…" : "Manage subscription"}
            </button>

            <Link href="/dashboard" style={{ alignSelf: "center", opacity: 0.9 }}>
              Back to dashboard
            </Link>
          </div>

          {error ? <p style={{ marginTop: 12, color: "#ff6b6b" }}>{error}</p> : null}
        </div>
      )}
    </main>
  );
}
