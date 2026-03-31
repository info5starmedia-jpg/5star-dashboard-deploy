import { requireAdminSession } from "@/lib/admin";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

type AuditRow = {
  id: string;
  actorEmail: string;
  action: string;
  targetEmail: string | null;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
};

const ACTION_BADGE: Record<string, string> = {
  role_change:      "bg-blue-50 text-blue-700 border-blue-200",
  invoice_create:   "bg-green-50 text-green-700 border-green-200",
  invoice_void:     "bg-amber-50 text-amber-700 border-amber-200",
  invoice_cancelled:"bg-red-50 text-red-600 border-red-200",
  inventory_create: "bg-violet-50 text-violet-700 border-violet-200",
  inventory_update: "bg-violet-50 text-violet-700 border-violet-200",
  inventory_delete: "bg-red-50 text-red-600 border-red-200",
};

function ActionBadge({ action }: { action: string }) {
  const cls = ACTION_BADGE[action] ?? "bg-zinc-100 text-zinc-500 border-zinc-200";
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${cls}`}>
      {action.replace(/_/g, " ")}
    </span>
  );
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function AdminAuditPage() {
  const session = await requireAdminSession();
  if (!session) redirect("/signin?callbackUrl=/admin/audit");

  const auditLogs = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      actorEmail: true,
      action: true,
      targetEmail: true,
      ip: true,
      userAgent: true,
      createdAt: true,
    },
  });

  const rows: AuditRow[] = auditLogs.map((l) => ({
    ...l,
    createdAt: l.createdAt.toISOString(),
  }));

  const actionCounts = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.action] = (acc[r.action] ?? 0) + 1;
    return acc;
  }, {});

  const uniqueActors = new Set(rows.map((r) => r.actorEmail)).size;

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Audit Log</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Last {rows.length} recorded actions across all admins.
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-zinc-200 bg-white px-5 py-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Total Events</p>
          <p className="mt-1 text-3xl font-bold text-zinc-900">{rows.length}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white px-5 py-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Active Admins</p>
          <p className="mt-1 text-3xl font-bold text-zinc-900">{uniqueActors}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white px-5 py-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Action Types</p>
          <p className="mt-1 text-3xl font-bold text-zinc-900">
            {Object.keys(actionCounts).length}
          </p>
        </div>
      </div>

      {/* Log table */}
      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
        {rows.length === 0 ? (
          <p className="px-6 py-10 text-sm text-zinc-400 text-center">No audit events yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead className="bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                <tr>
                  {["Time", "Actor", "Action", "Target", "IP"].map((h) => (
                    <th key={h} className="border-b border-zinc-200 px-4 py-3 text-left whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {rows.map((row) => (
                  <tr key={row.id} className="hover:bg-zinc-50">
                    <td className="px-4 py-3 text-zinc-500 whitespace-nowrap">
                      {fmtDate(row.createdAt)}
                    </td>
                    <td className="px-4 py-3 font-medium text-zinc-800 max-w-[180px] truncate">
                      {row.actorEmail}
                    </td>
                    <td className="px-4 py-3">
                      <ActionBadge action={row.action} />
                    </td>
                    <td className="px-4 py-3 text-zinc-500 max-w-[180px] truncate">
                      {row.targetEmail ?? <span className="text-zinc-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-zinc-400 font-mono text-xs whitespace-nowrap">
                      {row.ip ?? <span className="text-zinc-300">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-xs text-zinc-400">
        Showing latest 100 events. All admin actions are automatically recorded.
      </p>
    </main>
  );
}
