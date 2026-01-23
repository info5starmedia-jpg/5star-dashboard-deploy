"use client";

import { signIn } from "next-auth/react";
import Link from "next/link";

export default function SignInPage() {
  return (
    <main style={{ maxWidth: 720, margin: "60px auto", padding: "0 16px" }}>
      <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 10 }}>Sign in</h1>
      <p style={{ opacity: 0.85, marginBottom: 18 }}>
        Choose a provider to continue.
      </p>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <button
          onClick={() => signIn("discord", { callbackUrl: "/dashboard" })}
          style={{ padding: "10px 14px", borderRadius: 10, cursor: "pointer" }}
        >
          Sign in with Discord
        </button>

        <button
          onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
          style={{ padding: "10px 14px", borderRadius: 10, cursor: "pointer" }}
        >
          Sign in with Google
        </button>
      </div>

      <div style={{ marginTop: 18 }}>
        <Link href="/" style={{ opacity: 0.85 }}>
          ← Back to home
        </Link>
      </div>
    </main>
  );
}
