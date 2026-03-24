import Link from "next/link";

const tools = [
  { href: "/admin/inventory", label: "Inventory", desc: "Manage SKUs, stock levels, and pricing" },
  { href: "/admin/invoices", label: "Invoices", desc: "Create invoices and download PDFs" },
  { href: "/admin/analytics", label: "Analytics", desc: "Revenue charts and subscription metrics" },
  { href: "/admin/users", label: "Users", desc: "Manage user roles and permissions" },
  { href: "/admin/audit", label: "Audit Log", desc: "Track all admin actions" },
];

export default function AdminHome() {
  return (
    <main>
      <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>Admin Tools</h1>
      <p style={{ opacity: 0.7, marginBottom: 28 }}>Manage your 5Star Media dashboard.</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
        {tools.map((t) => (
          <Link key={t.href} href={t.href} style={{ padding: "16px 18px", border: "1px solid #e5e7eb", borderRadius: 10, textDecoration: "none", color: "inherit", display: "block" }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{t.label}</div>
            <div style={{ fontSize: 12, color: "#6b7280" }}>{t.desc}</div>
          </Link>
        ))}
      </div>
    </main>
  );
}
