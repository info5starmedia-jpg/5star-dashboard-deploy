import { redirect } from "next/navigation";
import AdminPanel from "@/components/AdminPanel";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/admin";
import { OWNER_EMAIL } from "@/lib/constants";

export default async function AdminAuditPage() {
  const session = await requireAdminSession();
  if (!session?.user?.email) {
    redirect(`/api/auth/signin?callbackUrl=${encodeURIComponent("/admin/audit")}`);
  }

  const [users, auditLogs] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: { email: true, role: true, createdAt: true, lastLoginAt: true },
    }),
    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { id: true, actorEmail: true, action: true, targetEmail: true, ip: true, userAgent: true, createdAt: true },
    }),
  ]);

  const userRows = users.map((user) => ({
    email: user.email,
    role: user.role,
    createdAt: user.createdAt.toISOString(),
    lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
  }));

  const auditRows = auditLogs.map((log) => ({
    id: log.id,
    actorEmail: log.actorEmail,
    action: log.action,
    targetEmail: log.targetEmail,
    ip: log.ip,
    userAgent: log.userAgent,
    createdAt: log.createdAt.toISOString(),
  }));

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10">
      <AdminPanel users={userRows} auditLogs={auditRows} ownerEmail={OWNER_EMAIL} />
    </main>
  );
}
