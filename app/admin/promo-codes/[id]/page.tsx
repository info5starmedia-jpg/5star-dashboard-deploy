"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

type Usage = {
  id: string;
  customerEmail: string;
  orderId: string;
  amountCents: number;
  createdAt: string;
};

type PromoCodeDetail = {
  id: string;
  code: string;
  promoter: string;
  discountType: "percent" | "amount";
  discountValue: number;
  isLifetime: boolean;
  expiresAt: string | null;
  isActive: boolean;
  totalUses: number;
  totalRevenueCents: number;
  stripeCouponId: string | null;
  stripePromoId: string | null;
  createdAt: string;
  usages: Usage[];
};

function fmt(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function Spinner() {
  return <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-orange-400/30 border-t-orange-400" />;
}

export default function PromoCodeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [code, setCode] = useState<PromoCodeDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/admin/promo-codes/${id}`)
      .then((r) => r.json())
      .then((d) => setCode(d.code ?? null))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-8 text-sm font-semibold text-orange-400">
        <Spinner /> Loading…
      </div>
    );
  }

  if (!code) {
    return (
      <div className="rounded-xl border border-red-500/40 bg-zinc-900 px-5 py-4 text-sm font-semibold text-red-400">
        Promo code not found.{" "}
        <Link href="/admin/promo-codes" className="underline text-orange-400">Back</Link>
      </div>
    );
  }

  return (
    <main className="space-y-6">
      <div>
        <Link href="/admin/promo-codes" className="text-xs font-bold text-orange-400 hover:underline">
          ← Back to Promo Codes
        </Link>
        <h1 className="mt-2 font-mono text-3xl font-extrabold text-orange-400">{code.code}</h1>
        <p className="mt-1 text-sm font-semibold text-orange-300">Promoter: {code.promoter}</p>
      </div>

      {/* Info cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Discount", value: code.discountType === "percent" ? `${code.discountValue}%` : fmt(code.discountValue) },
          { label: "Total Uses", value: String(code.totalUses) },
          { label: "Total Revenue", value: fmt(code.totalRevenueCents) },
          { label: "Status", value: code.isActive ? "Active" : "Inactive" },
        ].map((c) => (
          <div key={c.label} className="rounded-xl border border-orange-400/30 bg-zinc-900 px-5 py-4 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wide text-orange-400">{c.label}</p>
            <p className="mt-1 text-2xl font-extrabold text-orange-400">{c.value}</p>
          </div>
        ))}
      </div>

      {/* Detail */}
      <div className="rounded-2xl border border-orange-400/30 bg-zinc-900 p-5 shadow-sm space-y-2 text-sm">
        <p className="font-semibold text-orange-300">Type: <span className="text-orange-400 capitalize">{code.discountType}</span></p>
        <p className="font-semibold text-orange-300">Duration: <span className="text-orange-400">{code.isLifetime ? "Lifetime" : `Expires ${fmtDate(code.expiresAt)}`}</span></p>
        <p className="font-semibold text-orange-300">Created: <span className="text-orange-400">{fmtDate(code.createdAt)}</span></p>
        {code.stripeCouponId && (
          <p className="font-semibold text-orange-300">Stripe Coupon ID: <span className="font-mono text-xs text-orange-400">{code.stripeCouponId}</span></p>
        )}
        {code.stripePromoId && (
          <p className="font-semibold text-orange-300">Stripe Promo ID: <span className="font-mono text-xs text-orange-400">{code.stripePromoId}</span></p>
        )}
      </div>

      {/* Usage table */}
      <div>
        <h2 className="mb-3 text-base font-extrabold text-orange-400">Usage History ({code.usages.length})</h2>
        {code.usages.length === 0 ? (
          <div className="rounded-xl border border-orange-400/20 bg-zinc-900 px-5 py-6 text-center text-sm font-semibold text-orange-300">
            No uses yet.
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-orange-400/30 bg-zinc-900 shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead className="bg-zinc-800 text-xs font-bold uppercase tracking-wide text-orange-400">
                  <tr>
                    {["Customer", "Order ID", "Amount", "Date"].map((h) => (
                      <th key={h} className="border-b border-orange-400/20 px-4 py-3 text-left">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-orange-400/10">
                  {code.usages.map((u) => (
                    <tr key={u.id} className="hover:bg-zinc-800">
                      <td className="px-4 py-3 font-semibold text-orange-400">{u.customerEmail}</td>
                      <td className="px-4 py-3 font-mono text-xs text-orange-300">{u.orderId.slice(-12)}</td>
                      <td className="px-4 py-3 font-bold text-orange-400">{fmt(u.amountCents)}</td>
                      <td className="px-4 py-3 text-xs font-semibold text-orange-300">{fmtDate(u.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
