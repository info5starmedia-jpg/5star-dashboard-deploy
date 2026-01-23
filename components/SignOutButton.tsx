"use client";

import { signOut } from "next-auth/react";

export default function SignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/signin" })}
      className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-medium shadow-sm hover:bg-zinc-50"
      type="button"
    >
      Sign out
    </button>
  );
}
