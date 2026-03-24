import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdminSession } from "@/lib/admin";
import AdminThemeToggle from "@/components/AdminThemeToggle";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAdminSession();
  if (!session?.user?.email) {
    // Redirect to the custom sign-in page, not the default NextAuth endpoint
    redirect(`/signin?callbackUrl=${encodeURIComponent("/admin")}`);
  }

  return (
    <div className="admin-layout" style={{ maxWidth: 1100, margin: "24px auto", padding: "0 16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 20 }}>Admin</div>
          <div style={{ opacity: 0.8, fontSize: 13 }}>Signed in as {session.user.email}</div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link href="/dashboard">Dashboard</Link>
          <Link href="/admin">Admin Home</Link>
          <Link href="/admin/inventory">Inventory</Link>
          <Link href="/admin/invoices">Invoices</Link>
          <Link href="/admin/audit">Audit</Link>
          <AdminThemeToggle />
        </div>
      </div>

      <hr style={{ margin: "16px 0" }} />
      {children}
    </div>
  );
}
