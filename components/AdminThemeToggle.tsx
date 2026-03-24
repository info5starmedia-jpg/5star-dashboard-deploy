"use client";

import { useEffect, useState } from "react";

const storageKey = "admin-theme";

export default function AdminThemeToggle() {
  // Always initialise to false on the server — reading localStorage here
  // would cause a React hydration mismatch because the server always sees
  // undefined while the client may see "dark".
  const [enabled, setEnabled] = useState(false);
  const [mounted, setMounted] = useState(false);

  // After the first client render, sync state from localStorage.
  // This runs only in the browser so there is no mismatch.
  useEffect(() => {
    setEnabled(localStorage.getItem(storageKey) === "dark");
    setMounted(true);
  }, []);

  // Apply / remove the data attribute and persist the preference.
  useEffect(() => {
    // Skip the first render pass (before localStorage has been read)
    // so we don't flash the wrong theme.
    if (!mounted) return;

    const root = document.documentElement;
    if (enabled) {
      root.setAttribute("data-admin-theme", "dark");
      localStorage.setItem(storageKey, "dark");
    } else {
      root.removeAttribute("data-admin-theme");
      localStorage.setItem(storageKey, "light");
    }

    return () => {
      root.removeAttribute("data-admin-theme");
    };
  }, [enabled, mounted]);

  return (
    <button
      type="button"
      className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
      onClick={() => setEnabled((prev) => !prev)}
    >
      {mounted ? (enabled ? "Dark mode: On" : "Dark mode: Off") : "Dark mode"}
    </button>
  );
}
