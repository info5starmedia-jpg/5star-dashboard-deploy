"use client";
import { useEffect, useState } from "react";

type UserRow = {
  email: string;
  role: string;
  createdAt: string;
  lastLoginAt: string | null;
  subscriptionStatus: string | null;
  subscriptionEnd: string | null;
};

const fmtDate = (d: string | null) =>
  d
    ? new Date(d).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "—";

const SUB_BADGE: Record<string, string> = {
  active:    "bg-green-50 text-green-700 border-green-200",
  past_due:  "bg-amber-50 text-amber-700 border-amber-200",
  canceled:  "bg-red-50 text-red-500 border-red-200",
  cancelled: "bg-red-50 text-red-500 border-red-200",
  trialing:  "bg-blue-50 text-blue-600 border-blue-200",
};

function SubBadge({ status }: { status: string | null }) {
  if (!status) return <span className="text-zinc-400 text-xs">—</span>;
  const cls = SUB_BADGE[status] ?? "bg-zinc-100 text-zinc-500 border-zinc-200";
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${cls}`}>
      {status}
    </span>
  );
}

export default function UsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [flash, setFlash] = useState("");

  useEffect(() => {
    fetch("/api/admin/users")
      .then((r) => r.json())
      .then((d) => {
        setUsers(d.users ?? []);
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load users.");
        setLoading(false);
      });
  }, []);

  async function toggleRole(email: string, currentRole: string) {
    const newRole = currentRole === "admin" ? "user" : "admin";
    setBusy(email);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role: newRole }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(body.error || "Failed to update role.");
        return;
      }
      setUsers((prev) =>
        prev.map((u) => (u.email === email ? { ...u, role: body.user.role } : u))
      );
      setFlash(`${email} is now ${body.user.role}`);
      setTimeout(() => setFlash(""), 3000);
    } catch {
      alert("Network error.");
    } finally {
      setBusy(null);
    }
  }

  const admins = users.filter((u) => u.role === "admin").length;
  const activeSubscribers = users.filter((u) => u.subscriptionStatus === "active").length;

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-zinc-500 py-8">
        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-700" />
        Loading users…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">
        {error}
      </div>
    );
  }

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">User Management</h1>
        <p className="mt-1 text-sm text-zinc-500">
          {users.length} users — {admins} admin{admins !== 1 ? "s" : ""} —{" "}
          {activeSubscribers} active subscriber{activeSubscribers !== 1 ? "s" : ""}
        </p>
      </div>

      {flash && (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {flash}
        </div>
      )}

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Total Users", value: users.length, color: "text-zinc-900" },
          { label: "Admins", value: admins, color: "text-blue-700" },
          { label: "Active Subscribers", value: activeSubscribers, color: "text-green-700" },
        ].map((card) => (
          <div
            key={card.label}
            className="rounded-xl border border-zinc-200 bg-white px-5 py-4 shadow-sm"
          >
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              {card.label}
            </p>
            <p className={`mt-1 text-3xl font-bold ${card.color}`}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              <tr>
                {["Email", "Role", "Subscription", "Expires", "Joined", "Last Login", "Actions"].map((h) => (
                  <th key={h} className="border-b border-zinc-200 px-4 py-3 text-left">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {users.map((u) => (
                <tr
                  key={u.email}
                  className={u.role === "admin" ? "bg-blue-50/40" : "hover:bg-zinc-50"}
                >
                  <td className={`px-4 py-3 font-medium ${u.role === "admin" ? "text-blue-900" : "text-zinc-900"}`}>
                    {u.email}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                        u.role === "admin"
                          ? "bg-blue-100 text-blue-800"
                          : "bg-zinc-100 text-zinc-600"
                      }`}
                    >
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <SubBadge status={u.subscriptionStatus} />
                  </td>
                  <td className="px-4 py-3 text-zinc-500">{fmtDate(u.subscriptionEnd)}</td>
                  <td className="px-4 py-3 text-zinc-500">{fmtDate(u.createdAt)}</td>
                  <td className="px-4 py-3 text-zinc-500">{fmtDate(u.lastLoginAt)}</td>
                  <td className="px-4 py-3">
                    <button
                      disabled={busy === u.email}
                      onClick={() => toggleRole(u.email, u.role)}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${
                        u.role === "admin"
                          ? "border-red-200 bg-red-50 text-red-600 hover:bg-red-100"
                          : "border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
                      }`}
                    >
                      {busy === u.email
                        ? "Saving…"
                        : u.role === "admin"
                        ? "Remove Admin"
                        : "Make Admin"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-zinc-400">Role changes take effect on next sign-in.</p>
    </main>
  );
}
