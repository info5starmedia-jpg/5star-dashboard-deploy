import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/admin";

export async function GET() {
  const session = await requireAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [invoices, subscriptions] = await Promise.all([
    prisma.invoice.findMany({
      where: { status: "issued" },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true, totalCents: true, customerEmail: true },
    }),
    prisma.subscription.findMany({ select: { status: true } }),
  ]);

  // Build last 12 months buckets
  const now = new Date();
  const months: { key: string; label: string; totalCents: number; count: number }[] = [];
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
    if (bucket) { bucket.totalCents += inv.totalCents; bucket.count += 1; }
    if (inv.customerEmail) {
      const prev = customerMap.get(inv.customerEmail) ?? { totalCents: 0, count: 0 };
      customerMap.set(inv.customerEmail, { totalCents: prev.totalCents + inv.totalCents, count: prev.count + 1 });
    }
  }

  const thisMonth = months[months.length - 1];
  const lastMonth = months[months.length - 2];

  const topCustomers = [...customerMap.entries()]
    .map(([email, v]) => ({ email, ...v }))
    .sort((a, b) => b.totalCents - a.totalCents)
    .slice(0, 10);

  return NextResponse.json({
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
      cancelled: subscriptions.filter((s) => s.status === "canceled").length,
      total: subscriptions.length,
    },
    topCustomers,
  });
}
