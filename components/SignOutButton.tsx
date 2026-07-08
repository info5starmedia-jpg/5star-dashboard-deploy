"use client";

import { signOut } from "next-auth/react";

export default function SignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/signin" })}
      className="rounded-lg border-2 border-black bg-black px-3 py-2 text-sm font-bold text-white shadow-sm hover:bg-zinc-800 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
      type="button"
    >
      Sign out
    </button>
  );
}
