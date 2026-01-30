import Link from "next/link";

export default async function AdminHome() {
  return (
    <main>
      <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 10 }}>Admin Tools</h1>
      <p style={{ opacity: 0.85, marginBottom: 20 }}>
        Manage inventory and system settings.
      </p>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <Link href="/admin/inventory" style={{ padding: 12, border: "1px solid #ddd", borderRadius: 10 }}>
          Inventory
        </Link>
        <Link href="/admin/invoices" style={{ padding: 12, border: "1px solid #ddd", borderRadius: 10 }}>
          Invoices
        </Link>
      </div>
    </main>
  );
}
