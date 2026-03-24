import { requireAdminSession } from "@/lib/admin";
import { redirect } from "next/navigation";

type MonthBucket = { key: string; label: string; totalCents: number; count: number };
type AnalyticsData = {
  monthly: MonthBucket[];
  summary: { allTimeCents: number; allTimeCount: number; thisMonthCents: number; thisMonthCount: number; lastMonthCents: number };
  subscriptions: { active: number; pastDue: number; cancelled: number; total: number };
  topCustomers: { email: string; totalCents: number; count: number }[];
};

function fmt(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(cents / 100);
}

function RevenueChart({ monthly }: { monthly: MonthBucket[] }) {
  const max = Math.max(...monthly.map((m) => m.totalCents), 1);
  const W = 600, H = 160, PAD = 8, BAR_W = 32;
  const GAP = (W - PAD * 2 - BAR_W * monthly.length) / Math.max(monthly.length - 1, 1);
  return (
    <svg viewBox={`0 0 ${W} ${H + 32}`} style={{ width: "100%", height: "auto" }}>
      {monthly.map((m, i) => {
        const barH = Math.max(4, (m.totalCents / max) * H);
        const x = PAD + i * (BAR_W + GAP);
        const y = PAD + H - barH;
        return (
          <g key={m.key}>
            <rect x={x} y={y} width={BAR_W} height={barH} rx={4} fill={i === monthly.length - 1 ? "#2563eb" : "#93c5fd"} />
            {m.totalCents > 0 && (
              <text x={x + BAR_W / 2} y={y - 4} textAnchor="middle" fontSize={9} fill="#374151">{fmt(m.totalCents)}</text>
            )}
            <text x={x + BAR_W / 2} y={H + PAD + 18} textAnchor="middle" fontSize={9} fill="#6b7280">{m.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

function StatCard({ label, value, sub, alert }: { label: string; value: string; sub?: string; alert?: boolean }) {
  return (
    <div style={{ padding: "16px 20px", border: `1px solid ${alert ? "#fca5a5" : "#e5e7eb"}`, borderRadius: 10, minWidth: 160, background: alert ? "#fff1f2" : "white" }}>
      <div style={{ fontSize: 12, color: alert ? "#dc2626" : "#6b7280", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color: alert ? "#dc2626" : "#111827" }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

async function fetchAnalytics(): Promise<AnalyticsData | null> {
  try {
    const base = process.env.NEXTAUTH_URL || "http://localhost:3000";
    const res = await fetch(`${base}/api/admin/metrics/revenue`, { cache: "no-store" });
    if (!res.ok) return null;
    return res.json();
  } catch { return null; }
}

export default async function AnalyticsPage() {
  const session = await requireAdminSession();
  if (!session) redirect("/signin?callbackUrl=/admin/analytics");
  const data = await fetchAnalytics();
  if (!data) return <p style={{ color: "#ef4444" }}>Failed to load analytics.</p>;
  const { monthly, summary, subscriptions, topCustomers } = data;
  const momChange = summary.lastMonthCents > 0 ? ((summary.thisMonthCents - summary.lastMonthCents) / summary.lastMonthCents) * 100 : null;
  return (
    <main>
      <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 4 }}>Analytics</h1>
      <p style={{ color: "#6b7280", marginBottom: 24 }}>Revenue and subscription overview</p>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 32 }}>
        <StatCard label="All-Time Revenue" value={fmt(summary.allTimeCents)} sub={`${summary.allTimeCount} invoices`} />
        <StatCard label="This Month" value={fmt(summary.thisMonthCents)} sub={momChange !== null ? `${momChange >= 0 ? "+" : ""}${momChange.toFixed(1)}% vs last month` : `${summary.thisMonthCount} invoices`} />
        <StatCard label="Last Month" value={fmt(summary.lastMonthCents)} />
        <StatCard label="Active Subscriptions" value={String(subscriptions.active)} sub={`${subscriptions.total} total`} />
        {subscriptions.pastDue > 0 && <StatCard label="Past Due" value={String(subscriptions.pastDue)} sub="needs attention" alert />}
      </div>
      <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: "20px 24px", marginBottom: 32 }}>
        <div style={{ fontWeight: 700, marginBottom: 16 }}>Monthly Revenue — Last 12 Months</div>
        <RevenueChart monthly={monthly} />
      </div>
      {topCustomers.length > 0 && (
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: "20px 24px" }}>
          <div style={{ fontWeight: 700, marginBottom: 16 }}>Top Customers</div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
                <th style={{ textAlign: "left", padding: "6px 8px", color: "#6b7280", fontWeight: 600 }}>Customer</th>
                <th style={{ textAlign: "right", padding: "6px 8px", color: "#6b7280", fontWeight: 600 }}>Revenue</th>
                <th style={{ textAlign: "right", padding: "6px 8px", color: "#6b7280", fontWeight: 600 }}>Invoices</th>
              </tr>
            </thead>
            <tbody>
              {topCustomers.map((c, i) => (
                <tr key={c.email} style={{ borderBottom: i < topCustomers.length - 1 ? "1px solid #f3f4f6" : "none" }}>
                  <td style={{ padding: "8px" }}>{c.email}</td>
                  <td style={{ padding: "8px", textAlign: "right", fontWeight: 600 }}>{fmt(c.totalCents)}</td>
                  <td style={{ padding: "8px", textAlign: "right", color: "#6b7280" }}>{c.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
