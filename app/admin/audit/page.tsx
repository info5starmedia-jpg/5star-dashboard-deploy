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
  role_change:       "bg-blue-900/40 text-blue-300 border-blue-700",
  invoice_create:    "bg-green-900/40 text-green-300 border-green-700",
  invoice_void:      "bg-amber-900/40 text-amber-300 border-amber-700",
  invoice_cancelled: "bg-red-900/40 text-red-300 border-red-700",
  inventory_create:  "bg-violet-900/40 text-violet-300 border-violet-700",
  inventory_update:  "bg-violet-900/40 text-violet-300 border-violet-700",
  inventory_delete:  "bg-red-900/40 text-red-300 border-red-700",
};

function ActionBadge({ action }: { action: string }) {
  const cls = ACTION_BADGE[action] ?? "bg-zinc-800 text-orange-300 border-orange-400/30";
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${cls}`}>
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
        <h1 className="text-3xl font-extrabold text-orange-400">Audit Log</h1>
        <p className="mt-1 text-base font-semibold text-orange-300">
          Last {rows.length} recorded actions across all admins.
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Total Events", value: rows.length },
          { label: "Active Admins", value: uniqueActors },
          { label: "Action Types", value: Object.keys(actionCounts).length },
        ].map((card) => (
          <div key={card.label} className="rounded-xl border border-orange-400/30 bg-zinc-900 px-5 py-4 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wide text-orange-400">{card.label}</p>
            <p className="mt-1 text-3xl font-extrabold text-orange-400">{card.value}</p>
          </div>
        ))}
      </div>

      {/* Log table */}
      <div className="overflow-hidden rounded-2xl border border-orange-400/30 bg-zinc-900 shadow-sm">
        {rows.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm font-semibold text-orange-300">No audit events yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead className="bg-zinc-800 text-xs font-bold uppercase tracking-wide text-orange-400">
                <tr>
                  {["Time", "Actor", "Action", "Target", "IP"].map((h) => (
                    <th key={h} className="border-b border-orange-400/20 px-4 py-3 text-left whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-orange-400/10">
                {rows.map((row) => (
                  <tr key={row.id} className="hover:bg-zinc-800">
                    <td className="px-4 py-3 font-medium text-orange-300 whitespace-nowrap">
                      {fmtDate(row.createdAt)}
                    </td>
                    <td className="px-4 py-3 font-bold text-orange-400 max-w-[180px] truncate">
                      {row.actorEmail}
                    </td>
                    <td className="px-4 py-3">
                      <ActionBadge action={row.action} />
                    </td>
                    <td className="px-4 py-3 font-medium text-orange-300 max-w-[180px] truncate">
                      {row.targetEmail ?? <span className="text-orange-400/40">—</span>}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs font-medium text-orange-300 whitespace-nowrap">
                      {row.ip ?? <span className="text-orange-400/40">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-sm font-medium text-orange-300">
        Showing latest 100 events. All admin actions are automatically recorded.
      </p>
    </main>
  );
}
