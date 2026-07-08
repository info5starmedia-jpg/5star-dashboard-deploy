import { requireAdminSession } from "@/lib/admin";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

const fmt = (c: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(c / 100);

type MonthBucket = { key: string; label: string; totalCents: number; count: number };

async function loadAnalytics() {
  const [invoices, subscriptions] = await Promise.all([
    prisma.invoice.findMany({
      where: { status: "issued" },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true, totalCents: true, customerEmail: true },
    }),
    prisma.subscription.findMany({ select: { status: true } }),
  ]);

  const now = new Date();
  const months: MonthBucket[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: d.toLocaleString("en-US", { month: "short", year: "2-digit" }),
      totalCents: 0,
      count: 0,
    });
  }

  let allTimeCents = 0;
  const customerMap = new Map<string, { totalCents: number; count: number }>();

  for (const inv of invoices) {
    allTimeCents += inv.totalCents;
    const key = `${inv.createdAt.getFullYear()}-${String(inv.createdAt.getMonth() + 1).padStart(2, "0")}`;
    const bucket = months.find((m) => m.key === key);
    if (bucket) {
      bucket.totalCents += inv.totalCents;
      bucket.count += 1;
    }
    if (inv.customerEmail) {
      const prev = customerMap.get(inv.customerEmail) ?? { totalCents: 0, count: 0 };
      customerMap.set(inv.customerEmail, {
        totalCents: prev.totalCents + inv.totalCents,
        count: prev.count + 1,
      });
    }
  }

  const thisMonth = months[months.length - 1];
  const lastMonth = months[months.length - 2];

  const topCustomers = [...customerMap.entries()]
    .map(([email, v]) => ({ email, ...v }))
    .sort((a, b) => b.totalCents - a.totalCents)
    .slice(0, 10);

  return {
    monthly: months,
    summary: {
      allTimeCents,
      allTimeCount: invoices.length,
      thisMonthCents: thisMonth?.totalCents ?? 0,
      thisMonthCount: thisMonth?.count ?? 0,
      lastMonthCents: lastMonth?.totalCents ?? 0,
    },
    subscriptions: {
      active: subscriptions.filter((s) => s.status === "active").length,
      pastDue: subscriptions.filter((s) => s.status === "past_due").length,
      cancelled: subscriptions.filter((s) => s.status === "canceled" || s.status === "cancelled").length,
      total: subscriptions.length,
    },
    topCustomers,
  };
}

function BarChart({ monthly }: { monthly: MonthBucket[] }) {
  const max = Math.max(...monthly.map((m) => m.totalCents), 1);
  const W = 600, H = 160, P = 8, BW = 32;
  const GAP = (W - P * 2 - BW * monthly.length) / Math.max(monthly.length - 1, 1);
  return (
    <svg viewBox={`0 0 ${W} ${H + 32}`} className="w-full h-auto">
      {monthly.map((m, i) => {
        const bh = Math.max(4, (m.totalCents / max) * H);
        const x = P + i * (BW + GAP);
        const y = P + H - bh;
        const isLatest = i === monthly.length - 1;
        return (
          <g key={m.key}>
            <rect x={x} y={y} width={BW} height={bh} rx={4} fill={isLatest ? "#f97316" : "#fed7aa"} />
            {m.totalCents > 0 && (
              <text x={x + BW / 2} y={y - 4} textAnchor="middle" fontSize={9} fill="#fb923c">
                {fmt(m.totalCents)}
              </text>
            )}
            <text x={x + BW / 2} y={H + P + 18} textAnchor="middle" fontSize={9} fill="#fb923c">
              {m.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function StatCard({
  label,
  value,
  sub,
  warn,
}: {
  label: string;
  value: string;
  sub?: string;
  warn?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border px-5 py-4 shadow-sm ${
        warn
          ? "border-red-500/40 bg-zinc-900"
          : "border-orange-400/30 bg-zinc-900"
      }`}
    >
      <p className={`text-xs font-bold uppercase tracking-wide ${warn ? "text-red-400" : "text-orange-400"}`}>
        {label}
      </p>
      <p className="mt-1 text-3xl font-extrabold text-orange-400">{value}</p>
      {sub && <p className="mt-1 text-sm font-medium text-orange-300">{sub}</p>}
    </div>
  );
}

export default async function AnalyticsPage() {
  const session = await requireAdminSession();
  if (!session) redirect("/signin?callbackUrl=/admin/analytics");

  const { monthly, summary: sm, subscriptions: sub, topCustomers: tc } = await loadAnalytics();
  const mom =
    sm.lastMonthCents > 0
      ? ((sm.thisMonthCents - sm.lastMonthCents) / sm.lastMonthCents) * 100
      : null;

  return (
    <main className="space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold text-orange-400">Analytics</h1>
        <p className="mt-1 text-base font-semibold text-orange-300">Revenue and subscription overview</p>
      </div>

      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="All-Time Revenue"
          value={fmt(sm.allTimeCents)}
          sub={`${sm.allTimeCount} invoice${sm.allTimeCount !== 1 ? "s" : ""}`}
        />
        <StatCard
          label="This Month"
          value={fmt(sm.thisMonthCents)}
          sub={
            mom !== null
              ? `${mom >= 0 ? "+" : ""}${mom.toFixed(1)}% vs last month`
              : `${sm.thisMonthCount} invoice${sm.thisMonthCount !== 1 ? "s" : ""}`
          }
        />
        <StatCard label="Last Month" value={fmt(sm.lastMonthCents)} />
        <StatCard
          label="Active Subscriptions"
          value={String(sub.active)}
          sub={`${sub.total} total`}
        />
        {sub.pastDue > 0 && (
          <StatCard
            label="Past Due"
            value={String(sub.pastDue)}
            sub="needs attention"
            warn
          />
        )}
      </div>

      {/* Bar chart */}
      <div className="rounded-2xl border border-orange-400/30 bg-zinc-900 p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-bold text-orange-400">
          Monthly Revenue — Last 12 Months
        </h2>
        <BarChart monthly={monthly} />
      </div>

      {/* Top customers */}
      {tc.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-orange-400/30 bg-zinc-900 shadow-sm">
          <div className="border-b border-orange-400/20 px-6 py-4">
            <h2 className="text-lg font-bold text-orange-400">Top Customers</h2>
          </div>
          <table className="w-full border-collapse text-sm">
            <thead className="bg-zinc-800 text-xs font-bold uppercase tracking-wide text-orange-400">
              <tr>
                <th className="border-b border-orange-400/20 px-6 py-3 text-left">Customer</th>
                <th className="border-b border-orange-400/20 px-6 py-3 text-right">Revenue</th>
                <th className="border-b border-orange-400/20 px-6 py-3 text-right">Invoices</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-orange-400/10">
              {tc.map((c) => (
                <tr key={c.email} className="hover:bg-zinc-800">
                  <td className="px-6 py-3 font-medium text-orange-300">{c.email}</td>
                  <td className="px-6 py-3 text-right font-bold text-orange-400">
                    {fmt(c.totalCents)}
                  </td>
                  <td className="px-6 py-3 text-right font-semibold text-orange-300">{c.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
