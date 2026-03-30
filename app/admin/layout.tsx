import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdminSession } from "@/lib/admin";
import AdminThemeToggle from "@/components/AdminThemeToggle";

const navLinks = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/admin", label: "Home" },
  { href: "/admin/inventory", label: "Inventory" },
  { href: "/admin/invoices", label: "Invoices" },
  { href: "/admin/analytics", label: "Analytics" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/audit", label: "Audit" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAdminSession();
  if (!session?.user?.email) redirect(`/signin?callbackUrl=${encodeURIComponent("/admin")}`);

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-8">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-200 pb-5">
        <div>
          <div className="text-lg font-bold text-zinc-900">Admin</div>
          <div className="text-xs text-zinc-400">Signed in as {session.user.email}</div>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-lg px-3 py-1.5 text-sm text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900"
            >
              {link.label}
            </Link>
          ))}
          <AdminThemeToggle />
        </div>
      </div>

      <div className="mt-6">{children}</div>
    </div>
  );
}
