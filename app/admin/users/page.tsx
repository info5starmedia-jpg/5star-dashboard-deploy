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

function SubBadge({ status }: { status: string | null }) {
  if (!status) return <span className="text-zinc-500">—</span>;
  const colors: Record<string, string> = {
    active: "bg-green-800 text-green-200",
    trialing: "bg-blue-800 text-blue-200",
    past_due: "bg-amber-800 text-amber-200",
    canceled: "bg-red-800 text-red-200",
    cancelled: "bg-red-800 text-red-200",
  };
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-bold ${colors[status] ?? "bg-zinc-700 text-zinc-200"}`}
    >
      {status}
    </span>
  );
}

function RoleBadge({ role }: { role: string }) {
  const colors: Record<string, string> = {
    admin: "bg-orange-700 text-orange-100",
    promoter: "bg-purple-800 text-purple-200",
    user: "bg-zinc-700 text-zinc-300",
  };
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-bold ${colors[role] ?? "bg-zinc-700 text-zinc-300"}`}
    >
      {role}
    </span>
  );
}

export default function UsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [flash, setFlash] = useState<{ msg: string; ok: boolean } | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);

  async function loadUsers() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/users");
      if (res.ok) setUsers(await res.json());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  async function handleUpdateRole(email: string, newRole: string) {
    setUpdating(email);
    setFlash(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role: newRole }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFlash({ msg: data.error ?? "Failed to update role", ok: false });
      } else {
        setFlash({
          msg: `✓ ${email} is now "${newRole}". They'll see the change on their next sign-in.`,
          ok: true,
        });
        await loadUsers();
      }
    } catch {
      setFlash({ msg: "Network error — please try again.", ok: false });
    } finally {
      setUpdating(null);
      setTimeout(() => setFlash(null), 6000);
    }
  }

  const totalUsers = users.length;
  const totalAdmins = users.filter((u) => u.role === "admin").length;
  const totalPromoters = users.filter((u) => u.role === "promoter").length;
  const activeSubscribers = users.filter((u) => u.subscriptionStatus === "active").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold text-orange-400">User Management</h1>
        <p className="mt-1 text-sm font-semibold text-orange-300">
          {totalUsers} users — {totalAdmins} admin{totalAdmins !== 1 ? "s" : ""} —{" "}
          {totalPromoters} promoter{totalPromoters !== 1 ? "s" : ""} — {activeSubscribers}{" "}
          active subscriber{activeSubscribers !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "TOTAL USERS", value: totalUsers },
          { label: "ADMINS", value: totalAdmins },
          { label: "PROMOTERS", value: totalPromoters },
          { label: "ACTIVE SUBSCRIBERS", value: activeSubscribers },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-xl border border-orange-400/30 bg-zinc-900 p-4"
          >
            <p className="text-xs font-bold tracking-widest text-orange-400">{s.label}</p>
            <p className="mt-1 text-3xl font-extrabold text-orange-300">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Flash message */}
      {flash && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm font-semibold ${
            flash.ok
              ? "border-green-500/40 bg-green-900/30 text-green-200"
              : "border-red-500/40 bg-red-900/30 text-red-200"
          }`}
        >
          {flash.msg}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-orange-400">Loading users…</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-orange-400/20 bg-zinc-900">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-orange-400/20 text-left text-xs font-bold tracking-widest text-orange-400">
                <th className="px-4 py-3">EMAIL</th>
                <th className="px-4 py-3">ROLE</th>
                <th className="px-4 py-3">SUBSCRIPTION</th>
                <th className="px-4 py-3">EXPIRES</th>
                <th className="px-4 py-3">JOINED</th>
                <th className="px-4 py-3">LAST LOGIN</th>
                <th className="px-4 py-3">UPDATE ROLE</th>
              </tr>
            </thead>
            <tbody>
              {users.map((row, i) => (
                <tr
                  key={row.email}
                  className={`border-b border-orange-400/10 ${i % 2 === 0 ? "" : "bg-zinc-800/40"}`}
                >
                  <td className="px-4 py-3 font-semibold text-orange-100">{row.email}</td>
                  <td className="px-4 py-3">
                    <RoleBadge role={row.role} />
                  </td>
                  <td className="px-4 py-3">
                    <SubBadge status={row.subscriptionStatus} />
                  </td>
                  <td className="px-4 py-3 text-zinc-400">
                    {row.subscriptionEnd
                      ? new Date(row.subscriptionEnd).toLocaleDateString()
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-zinc-400">
                    {new Date(row.createdAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </td>
                  <td className="px-4 py-3 text-zinc-400">
                    {row.lastLoginAt
                      ? new Date(row.lastLoginAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={row.role}
                      disabled={updating === row.email}
                      onChange={(e) => handleUpdateRole(row.email, e.target.value)}
                      className="rounded-lg border border-orange-400/40 bg-zinc-800 px-3 py-1.5 text-sm font-bold text-orange-300 transition hover:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-400 disabled:opacity-50 cursor-pointer"
                    >
                      <option value="user">User</option>
                      <option value="admin">Admin</option>
                      <option value="promoter">Promoter</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-zinc-500">
        Role changes take effect on the user's next sign-in. The role badge updates immediately.
      </p>
    </div>
  );
}
