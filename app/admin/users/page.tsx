"use client";
import { useEffect, useState } from "react";

type UserRow = { email: string; role: string; createdAt: string; lastLoginAt: string | null };

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";

export default function UsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [flash, setFlash] = useState("");

  useEffect(() => {
    fetch("/api/admin/users")
      .then((r) => r.json())
      .then((d) => { setUsers(d.users ?? []); setLoading(false); })
      .catch(() => { setError("Failed to load users."); setLoading(false); });
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
      if (!res.ok) { alert(body.error || "Failed to update role."); return; }
      setUsers((prev) => prev.map((u) => (u.email === email ? { ...u, role: body.user.role } : u)));
      setFlash(`${email} is now ${body.user.role}`);
      setTimeout(() => setFlash(""), 3000);
    } catch { alert("Network error."); } finally { setBusy(null); }
  }

  const admins = users.filter((u) => u.role === "admin").length;
  if (loading) return <p style={{ color: "#6b7280" }}>Loading users...</p>;
  if (error) return <p style={{ color: "#ef4444" }}>{error}</p>;

  return (
    <main>
      <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 4 }}>User Management</h1>
      <p style={{ color: "#6b7280", marginBottom: 24 }}>{users.length} users — {admins} admin{admins !== 1 ? "s" : ""}</p>
      {flash && (
        <div style={{ marginBottom: 16, padding: "10px 16px", background: "#dcfce7", border: "1px solid #86efac", borderRadius: 8, color: "#166534", fontSize: 13 }}>
          {flash}
        </div>
      )}
      <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead style={{ background: "#f9fafb" }}>
            <tr>
              {["Email", "Role", "Joined", "Last Login", "Actions"].map((h) => (
                <th key={h} style={{ textAlign: "left", padding: "10px 16px", fontWeight: 600, color: "#374151", borderBottom: "1px solid #e5e7eb" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map((u, i) => (
              <tr key={u.email} style={{ borderTop: i > 0 ? "1px solid #f3f4f6" : "none", background: u.role === "admin" ? "#eff6ff" : "white" }}>
                <td style={{ padding: "10px 16px", fontWeight: u.role === "admin" ? 600 : 400 }}>{u.email}</td>
                <td style={{ padding: "10px 16px" }}>
                  <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 9999, fontSize: 11, fontWeight: 600, background: u.role === "admin" ? "#dbeafe" : "#f3f4f6", color: u.role === "admin" ? "#1d4ed8" : "#6b7280" }}>
                    {u.role}
                  </span>
                </td>
                <td style={{ padding: "10px 16px", color: "#6b7280" }}>{fmtDate(u.createdAt)}</td>
                <td style={{ padding: "10px 16px", color: "#6b7280" }}>{fmtDate(u.lastLoginAt)}</td>
                <td style={{ padding: "10px 16px" }}>
                  <button
                    disabled={busy === u.email}
                    onClick={() => toggleRole(u.email, u.role)}
                    style={{ padding: "4px 12px", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: busy === u.email ? "not-allowed" : "pointer", border: "1px solid", borderColor: u.role === "admin" ? "#fca5a5" : "#86efac", background: u.role === "admin" ? "#fee2e2" : "#dcfce7", color: u.role === "admin" ? "#dc2626" : "#16a34a", opacity: busy === u.email ? 0.6 : 1 }}
                  >
                    {busy === u.email ? "Saving..." : u.role === "admin" ? "Remove Admin" : "Make Admin"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p style={{ marginTop: 16, fontSize: 12, color: "#9ca3af" }}>Role changes take effect on next sign-in.</p>
    </main>
  );
}
