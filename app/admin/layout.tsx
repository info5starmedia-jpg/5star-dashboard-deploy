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
  { href: "/admin/promo-codes", label: "Promo Codes" },
  { href: "/admin/audit", label: "Audit" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAdminSession();
  if (!session?.user?.email) redirect(`/signin?callbackUrl=${encodeURIComponent("/admin")}`);

  return (
    <div className="mx-auto w-full max-w-[1600px] px-6 py-8">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-200 pb-5 dark:border-zinc-700">
        <div>
          <div className="text-xl font-extrabold text-orange-400 tracking-tight">Admin</div>
          <div className="text-sm font-bold text-orange-300">Signed in as {session.user.email}</div>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-lg bg-orange-400 px-3 py-2 text-sm font-bold text-black transition hover:bg-orange-500 dark:bg-orange-500 dark:text-black dark:hover:bg-orange-400"
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
