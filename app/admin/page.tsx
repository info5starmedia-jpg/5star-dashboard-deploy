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
      <h1 className="text-2xl font-bold text-orange-400">Admin Tools</h1>
      <p className="mt-2 text-sm text-zinc-400">Manage your Viking Essentials dashboard.</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tools.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className="rounded-xl border border-orange-400/30 bg-zinc-900 p-5 shadow-sm transition hover:border-orange-400/50 hover:shadow-md"
          >
            <div className="text-base font-semibold text-orange-300">{t.label}</div>
            <div className="mt-1 text-sm text-zinc-400">{t.desc}</div>
          </Link>
        ))}
      </div>
    </main>
  );
}
