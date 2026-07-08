"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

type Usage = {
  id: string;
  customerEmail: string;
  orderId: string;
  amountCents: number;
  createdAt: string;
};

type PromoCode = {
  id: string;
  code: string;
  discountType: "percent" | "amount";
  discountValue: number;
  isLifetime: boolean;
  expiresAt: string | null;
  isActive: boolean;
  totalUses: number;
  totalRevenueCents: number;
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

export default function PromoPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [codes, setCodes] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(true);

  const user = session?.user as { isPromoter?: boolean; isAdmin?: boolean } | undefined;

  useEffect(() => {
    if (status === "unauthenticated") { router.push("/signin"); return; }
    if (status !== "authenticated") return;
    if (!user?.isPromoter && !user?.isAdmin) { router.push("/dashboard"); return; }

    fetch("/api/user/promo-stats")
      .then((r) => r.json())
      .then((d) => setCodes(d.codes ?? []))
      .finally(() => setLoading(false));
  }, [status, user, router]);

  if (status === "loading" || loading) {
    return (
      <div className="flex h-64 items-center justify-center gap-2 text-sm font-bold text-orange-400">
        <Spinner /> Loading…
      </div>
    );
  }

  const totalUses = codes.reduce((s, c) => s + c.totalUses, 0);
  const totalRevenue = codes.reduce((s, c) => s + c.totalRevenueCents, 0);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-6 py-10">
      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-orange-400">Promoter Dashboard</p>
        <h1 className="text-3xl font-extrabold text-orange-400">My Promo Codes</h1>
        <p className="mt-1 text-sm font-bold text-orange-300">{session?.user?.email}</p>
      </div>

      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Active Codes", value: codes.filter((c) => c.isActive).length },
          { label: "Total Uses", value: totalUses },
          { label: "Revenue Generated", value: fmt(totalRevenue) },
        ].map((c) => (
          <div key={c.label} className="rounded-xl border border-orange-400/30 bg-zinc-900 px-5 py-4 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wide text-orange-400">{c.label}</p>
            <p className="mt-1 text-2xl font-extrabold text-orange-400">{c.value}</p>
          </div>
        ))}
      </div>

      {codes.length === 0 ? (
        <div className="rounded-xl border border-orange-400/20 bg-zinc-900 px-5 py-8 text-center text-sm font-semibold text-orange-300">
          No promo codes assigned to your account yet. Contact your admin.
        </div>
      ) : (
        <div className="space-y-5">
          {codes.map((c) => (
            <div key={c.id} className="rounded-2xl border border-orange-400/30 bg-zinc-900 p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-mono text-xl font-extrabold text-orange-400">{c.code}</p>
                  <p className="text-sm font-semibold text-orange-300">
                    {c.discountType === "percent" ? `${c.discountValue}% off` : `${fmt(c.discountValue)} off`}
                    {" · "}
                    {c.isLifetime ? "Lifetime" : `Expires ${fmtDate(c.expiresAt)}`}
                  </p>
                </div>
                <div className="flex gap-4 text-right">
                  <div>
                    <p className="text-xs font-bold uppercase text-orange-400">Uses</p>
                    <p className="text-2xl font-extrabold text-orange-400">{c.totalUses}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase text-orange-400">Revenue</p>
                    <p className="text-2xl font-extrabold text-orange-400">{fmt(c.totalRevenueCents)}</p>
                  </div>
                </div>
              </div>

              {c.usages.length > 0 && (
                <div className="overflow-hidden rounded-xl border border-orange-400/20">
                  <table className="w-full border-collapse text-xs">
                    <thead className="bg-zinc-800 font-bold text-orange-400">
                      <tr>
                        {["Customer", "Amount", "Date"].map((h) => (
                          <th key={h} className="border-b border-orange-400/20 px-3 py-2 text-left">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-orange-400/10">
                      {c.usages.map((u) => (
                        <tr key={u.id} className="hover:bg-zinc-800">
                          <td className="px-3 py-2 font-semibold text-orange-300">{u.customerEmail}</td>
                          <td className="px-3 py-2 font-bold text-orange-400">{fmt(u.amountCents)}</td>
                          <td className="px-3 py-2 text-orange-300">{fmtDate(u.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
