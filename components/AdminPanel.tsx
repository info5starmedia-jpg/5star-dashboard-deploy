"use client";

import { useMemo, useState } from "react";

type UserRow = {
  email: string;
  role: string;
  createdAt: string;
  lastLoginAt: string | null;
};

type AuditRow = {
  id: string;
  actorEmail: string;
  action: string;
  targetEmail: string | null;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
};

export default function AdminPanel(props: {
  users: UserRow[];
  auditLogs: AuditRow[];
  ownerEmail: string;
}) {
  const [users, setUsers] = useState<UserRow[]>(props.users);
  const [logs, setLogs] = useState<AuditRow[]>(props.auditLogs);
  const [busy, setBusy] = useState<string | null>(null);

  const owner = props.ownerEmail.toLowerCase();

  const sortedUsers = useMemo(() => {
    return [...users].sort((a, b) => (a.email > b.email ? 1 : -1));
  }, [users]);

  async function refreshAudit() {
    const res = await fetch("/api/admin/audit", { cache: "no-store" });
    if (res.ok) {
      const json = await res.json();
      setLogs(json.logs ?? []);
    }
  }

  async function setRole(email: string, role: "user" | "admin") {
    setBusy(email);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, role }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed");
      setUsers((prev) =>
        prev.map((u) => (u.email === email ? { ...u, role: json.user.role } : u))
      );
      await refreshAudit();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="grid gap-8">
      <section className="admin-card rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold">Users</h2>
          <button
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50"
            onClick={async () => {
              const res = await fetch("/api/admin/users", { cache: "no-store" });
              const json = await res.json();
              if (res.ok) setUsers(json.users ?? []);
            }}
            type="button"
          >
            Refresh
          </button>
        </div>

        <div className="mt-4 overflow-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-slate-600">
              <tr>
                <th className="py-2">Email</th>
                <th className="py-2">Role</th>
                <th className="py-2">Created</th>
                <th className="py-2">Last login</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedUsers.map((u) => {
                const isOwner = u.email.toLowerCase() === owner;
                const isAdmin = u.role === "admin";
                return (
                  <tr key={u.email} className="border-t">
                    <td className="py-2 font-medium">{u.email}</td>
                    <td className="py-2">{u.role}</td>
                    <td className="py-2">{new Date(u.createdAt).toLocaleString()}</td>
                    <td className="py-2">
                      {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : "—"}
                    </td>
                    <td className="py-2">
                      {isOwner ? (
                        <span className="text-xs text-slate-500">Owner (locked)</span>
                      ) : (
                        <div className="flex gap-2">
                          <button
                            disabled={busy === u.email || isAdmin}
                            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs hover:bg-slate-50 disabled:opacity-50"
                            onClick={() => setRole(u.email, "admin")}
                            type="button"
                          >
                            Promote
                          </button>
                          <button
                            disabled={busy === u.email || !isAdmin}
                            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs hover:bg-slate-50 disabled:opacity-50"
                            onClick={() => setRole(u.email, "user")}
                            type="button"
                          >
                            Demote
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="admin-card rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold">Audit logs (latest 50)</h2>
          <button
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50"
            onClick={refreshAudit}
            type="button"
          >
            Refresh
          </button>
        </div>

        <div className="mt-4 overflow-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-slate-600">
              <tr>
                <th className="py-2">Time</th>
                <th className="py-2">Actor</th>
                <th className="py-2">Action</th>
                <th className="py-2">Target</th>
                <th className="py-2">IP</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id} className="border-t">
                  <td className="py-2">{new Date(l.createdAt).toLocaleString()}</td>
                  <td className="py-2">{l.actorEmail}</td>
                  <td className="py-2">{l.action}</td>
                  <td className="py-2">{l.targetEmail ?? "—"}</td>
                  <td className="py-2">{l.ip ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
