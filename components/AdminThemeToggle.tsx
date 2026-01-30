"use client";

import { useEffect, useState } from "react";

const storageKey = "admin-theme";

export default function AdminThemeToggle() {
  const [enabled, setEnabled] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(storageKey) === "dark";
  });

  useEffect(() => {
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
  }, [enabled]);

  return (
    <button
      type="button"
      className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
      onClick={() => setEnabled((prev) => !prev)}
    >
      {enabled ? "Dark mode: On" : "Dark mode: Off"}
    </button>
  );
}
