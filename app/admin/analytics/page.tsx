import { requireAdminSession } from "@/lib/admin";
import { redirect } from "next/navigation";

type MB = { key: string; label: string; totalCents: number; count: number };
type AD = {
  monthly: MB[];
  summary: { allTimeCents: number; allTimeCount: number; thisMonthCents: number; thisMonthCount: number; lastMonthCents: number };
  subscriptions: { active: number; pastDue: number; cancelled: number; total: number };
  topCustomers: { email: string; totalCents: number; count: number }[];
};

const fmt = (c: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(c / 100);

function Chart({ monthly }: { monthly: MB[] }) {
  const max = Math.max(...monthly.map((m) => m.totalCents), 1);
  const W = 600, H = 160, P = 8, BW = 32;
  const GAP = (W - P * 2 - BW * monthly.length) / Math.max(monthly.length - 1, 1);
  return (
    <svg viewBox={`0 0 ${W} ${H + 32}`} style={{ width: "100%", height: "auto" }}>
      {monthly.map((m, i) => {
        const bh = Math.max(4, (m.totalCents / max) * H);
        const x = P + i * (BW + GAP);
        const y = P + H - bh;
        return (
          <g key={m.key}>
            <rect x={x} y={y} width={BW} height={bh} rx={4} fill={i === monthly.length - 1 ? "#2563eb" : "#93c5fd"} />
            {m.totalCents > 0 && (
              <text x={x + BW / 2} y={y - 4} textAnchor="middle" fontSize={9} fill="#374151">{fmt(m.totalCents)}</text>
            )}
            <text x={x + BW / 2} y={H + P + 18} textAnchor="middle" fontSize={9} fill="#6b7280">{m.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

function Card({ label, value, sub, warn }: { label: string; value: string; sub?: string; warn?: boolean }) {
  return (
    <div style={{ padding: "16px 20px", border: `1px solid ${warn ? "#fca5a5" : "#e5e7eb"}`, borderRadius: 10, minWidth: 160, background: warn ? "#fff1f2" : "white" }}>
      <div style={{ fontSize: 12, color: warn ? "#dc2626" : "#6b7280", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

async function load(): Promise<AD | null> {
  try {
    const base = process.env.NEXTAUTH_URL || "http://localhost:3000";
    const r = await fetch(`${base}/api/admin/metrics/revenue`, { cache: "no-store" });
    return r.ok ? r.json() : null;
  } catch { return null; }
}

export default async function AnalyticsPage() {
  const session = await requireAdminSession();
  if (!session) redirect("/signin?callbackUrl=/admin/analytics");
  const d = await load();
  if (!d) return <p style={{ color: "#ef4444" }}>Failed to load analytics.</p>;
  const { monthly, summary: sm, subscriptions: sub, topCustomers: tc } = d;
  const mom = sm.lastMonthCents > 0 ? ((sm.thisMonthCents - sm.lastMonthCents) / sm.lastMonthCents) * 100 : null;
  return (
    <main>
      <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 4 }}>Analytics</h1>
      <p style={{ color: "#6b7280", marginBottom: 24 }}>Revenue and subscription overview</p>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 32 }}>
        <Card label="All-Time Revenue" value={fmt(sm.allTimeCents)} sub={`${sm.allTimeCount} invoices`} />
        <Card label="This Month" value={fmt(sm.thisMonthCents)} sub={mom !== null ? `${mom >= 0 ? "+" : ""}${mom.toFixed(1)}% vs last month` : `${sm.thisMonthCount} invoices`} />
        <Card label="Last Month" value={fmt(sm.lastMonthCents)} />
        <Card label="Active Subscriptions" value={String(sub.active)} sub={`${sub.total} total`} />
        {sub.pastDue > 0 && <Card label="Past Due" value={String(sub.pastDue)} sub="needs attention" warn />}
      </div>
      <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: "20px 24px", marginBottom: 32 }}>
        <div style={{ fontWeight: 700, marginBottom: 16 }}>Monthly Revenue — Last 12 Months</div>
        <Chart monthly={monthly} />
      </div>
      {tc.length > 0 && (
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: "20px 24px" }}>
          <div style={{ fontWeight: 700, marginBottom: 16 }}>Top Customers</div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
                <th style={{ textAlign: "left", padding: "6px 8px", color: "#6b7280" }}>Customer</th>
                <th style={{ textAlign: "right", padding: "6px 8px", color: "#6b7280" }}>Revenue</th>
                <th style={{ textAlign: "right", padding: "6px 8px", color: "#6b7280" }}>Invoices</th>
              </tr>
            </thead>
            <tbody>
              {tc.map((c, i) => (
                <tr key={c.email} style={{ borderBottom: i < tc.length - 1 ? "1px solid #f3f4f6" : "none" }}>
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
