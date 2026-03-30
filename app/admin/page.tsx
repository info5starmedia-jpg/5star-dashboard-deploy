import Link from "next/link";

const adminLinks = [
  { href: "/admin/inventory", label: "Inventory", desc: "Manage stock, SKUs, and pricing" },
  { href: "/admin/analytics", label: "Analytics", desc: "Revenue, subscribers, and metrics" },
  { href: "/admin/invoices", label: "Invoices", desc: "Create and manage invoices" },
  { href: "/admin/audit", label: "Audit", desc: "User management and action logs" },
];

export default async function AdminHome() {
  return (
    <main>
      <h1 className="text-2xl font-bold text-zinc-900">Admin Tools</h1>
      <p className="mt-2 text-sm text-zinc-500">
        Manage inventory, users, and system settings.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {adminLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:border-zinc-300 hover:shadow-md"
          >
            <div className="text-base font-semibold text-zinc-900">{link.label}</div>
            <div className="mt-1 text-sm text-zinc-500">{link.desc}</div>
          </Link>
        ))}
      </div>
    </main>
  );
}
