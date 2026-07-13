"use client";

import { useEffect, useState } from "react";

// Products that have Stripe product IDs and can be restricted
const STRIPE_PRODUCTS = [
  { id: "prod_UHAdq1BkXKxWen", name: "VIKING HELGER SERVER" },
  { id: "prod_UH8iAH5xWEsbFz", name: "HUSCARL USA ISP — 10 Pack" },
  { id: "prod_UH8p0QG8naGuCc", name: "HUSCARL USA ISP — 25 Pack" },
  { id: "prod_UH8uy4dviKUzHb", name: "HUSCARL USA ISP — 50 Pack" },
];

type PromoCode = {
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
  appliesToProducts: string[] | null;
  createdAt: string;
};

function fmt(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function ProductTags({ productIds }: { productIds: string[] | null }) {
  if (!productIds || productIds.length === 0) {
    return <span className="rounded-full bg-zinc-700 px-2 py-0.5 text-xs font-bold text-zinc-300">All Products</span>;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {productIds.map((pid) => {
        const product = STRIPE_PRODUCTS.find((p) => p.id === pid);
        return (
          <span key={pid} className="rounded-full bg-orange-900/60 px-2 py-0.5 text-xs font-bold text-orange-200">
            {product ? product.name : pid}
          </span>
        );
      })}
    </div>
  );
}

function Spinner() {
  return <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-orange-400/30 border-t-orange-400" />;
}

export default function PromoCodesPage() {
  const [codes, setCodes] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [flash, setFlash] = useState("");
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    code: "",
    promoter: "",
    discountType: "percent" as "percent" | "amount",
    discountValue: "",
    isLifetime: true,
    expiresAt: "",
    isActive: true,
    appliesToProducts: [] as string[], // empty = all products
  });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  function loadCodes() {
    setLoading(true);
    setError("");
    fetch("/api/admin/promo-codes")
      .then((r) => r.json())
      .then((d) => setCodes(d.codes ?? []))
      .catch(() => setError("Failed to load promo codes."))
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadCodes(); }, []);

  function toggleProduct(productId: string) {
    setForm((prev) => ({
      ...prev,
      appliesToProducts: prev.appliesToProducts.includes(productId)
        ? prev.appliesToProducts.filter((id) => id !== productId)
        : [...prev.appliesToProducts, productId],
    }));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    if (!form.code.trim() || !form.promoter.trim() || !form.discountValue) {
      setFormError("Code, promoter, and discount value are required.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/promo-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: form.code.trim().toUpperCase(),
          promoter: form.promoter.trim(),
          discountType: form.discountType,
          discountValue: Number(form.discountValue),
          isLifetime: form.isLifetime,
          expiresAt: form.isLifetime ? null : form.expiresAt || null,
          isActive: form.isActive,
          appliesToProducts: form.appliesToProducts,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFormError(data.error || "Failed to create.");
        return;
      }
      setFlash(`✅ Code ${data.promoCode.code} created and synced to Stripe.`);
      setTimeout(() => setFlash(""), 6000);
      setShowForm(false);
      setForm({
        code: "", promoter: "", discountType: "percent", discountValue: "",
        isLifetime: true, expiresAt: "", isActive: true, appliesToProducts: [],
      });
      loadCodes();
    } catch {
      setFormError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggle(id: string, current: boolean) {
    setBusy(id);
    try {
      const res = await fetch(`/api/admin/promo-codes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !current }),
      });
      if (res.ok) {
        setCodes((prev) => prev.map((c) => c.id === id ? { ...c, isActive: !current } : c));
        setFlash(`Code ${!current ? "activated" : "deactivated"}.`);
        setTimeout(() => setFlash(""), 3000);
      }
    } finally { setBusy(null); }
  }

  async function handleDelete(id: string, code: string) {
    if (!confirm(`Delete code "${code}"? This also deactivates it in Stripe and cannot be undone.`)) return;
    setBusy(id);
    try {
      const res = await fetch(`/api/admin/promo-codes?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        setCodes((prev) => prev.filter((c) => c.id !== id));
        setFlash(`Code ${code} deleted.`);
        setTimeout(() => setFlash(""), 3000);
      }
    } finally { setBusy(null); }
  }

  const totalRevenue = codes.reduce((s, c) => s + c.totalRevenueCents, 0);
  const totalUses = codes.reduce((s, c) => s + c.totalUses, 0);

  // Promoter summary
  const promoterMap = new Map<string, { uses: number; revenue: number; codes: number }>();
  codes.forEach((c) => {
    const p = promoterMap.get(c.promoter) ?? { uses: 0, revenue: 0, codes: 0 };
    promoterMap.set(c.promoter, {
      uses: p.uses + c.totalUses,
      revenue: p.revenue + c.totalRevenueCents,
      codes: p.codes + 1,
    });
  });
  const promoterRows = Array.from(promoterMap.entries()).sort((a, b) => b[1].revenue - a[1].revenue);

  return (
    <main className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-orange-400">Promo Codes</h1>
          <p className="mt-1 text-sm font-semibold text-orange-300">
            {codes.length} codes — {totalUses} total uses — {fmt(totalRevenue)} total revenue
          </p>
        </div>
        <button
          onClick={() => { setShowForm((v) => !v); setFormError(""); }}
          className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-bold text-black transition hover:bg-orange-400"
        >
          {showForm ? "Cancel" : "+ New Code"}
        </button>
      </div>

      {/* Flash */}
      {flash && (
        <div className="rounded-lg border border-green-500/40 bg-green-900/30 px-4 py-3 text-sm font-semibold text-green-200">
          {flash}
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-red-500/40 bg-red-900/30 px-4 py-3 text-sm font-semibold text-red-300">
          {error}
        </div>
      )}

      {/* Create Form */}
      {showForm && (
        <div className="rounded-xl border border-orange-400/30 bg-zinc-900 p-6">
          <h2 className="mb-4 text-lg font-extrabold text-orange-400">Create Promo Code</h2>
          <form onSubmit={handleCreate} className="space-y-5">
            {/* Code + Promoter */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-bold tracking-widest text-orange-400">CODE</label>
                <input
                  value={form.code}
                  onChange={(e) => setForm((p) => ({ ...p, code: e.target.value.toUpperCase() }))}
                  placeholder="e.g. JOHN20"
                  className="w-full rounded-lg border border-orange-400/30 bg-zinc-800 px-3 py-2 text-sm font-semibold text-orange-100 placeholder-zinc-500 focus:border-orange-400 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold tracking-widest text-orange-400">PROMOTER</label>
                <input
                  value={form.promoter}
                  onChange={(e) => setForm((p) => ({ ...p, promoter: e.target.value }))}
                  placeholder="email or name"
                  className="w-full rounded-lg border border-orange-400/30 bg-zinc-800 px-3 py-2 text-sm font-semibold text-orange-100 placeholder-zinc-500 focus:border-orange-400 focus:outline-none"
                />
              </div>
            </div>

            {/* Discount Type + Value */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-bold tracking-widest text-orange-400">DISCOUNT TYPE</label>
                <select
                  value={form.discountType}
                  onChange={(e) => setForm((p) => ({ ...p, discountType: e.target.value as "percent" | "amount" }))}
                  className="w-full rounded-lg border border-orange-400/30 bg-zinc-800 px-3 py-2 text-sm font-semibold text-orange-100 focus:border-orange-400 focus:outline-none"
                >
                  <option value="percent">Percentage (%)</option>
                  <option value="amount">Fixed Amount ($)</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold tracking-widest text-orange-400">
                  {form.discountType === "percent" ? "PERCENTAGE (1–100)" : "AMOUNT IN CENTS (e.g. 1000 = $10)"}
                </label>
                <input
                  type="number"
                  value={form.discountValue}
                  onChange={(e) => setForm((p) => ({ ...p, discountValue: e.target.value }))}
                  placeholder={form.discountType === "percent" ? "20" : "1000"}
                  min="1"
                  max={form.discountType === "percent" ? "100" : undefined}
                  className="w-full rounded-lg border border-orange-400/30 bg-zinc-800 px-3 py-2 text-sm font-semibold text-orange-100 placeholder-zinc-500 focus:border-orange-400 focus:outline-none"
                />
              </div>
            </div>

            {/* APPLIES TO — Product Selector */}
            <div>
              <label className="mb-2 block text-xs font-bold tracking-widest text-orange-400">
                APPLIES TO
              </label>
              <p className="mb-3 text-xs text-zinc-400">
                Select specific products this code applies to. Leave all unchecked for a universal code (works on any product).
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {STRIPE_PRODUCTS.map((product) => (
                  <label
                    key={product.id}
                    className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 transition ${
                      form.appliesToProducts.includes(product.id)
                        ? "border-orange-400 bg-orange-900/30 text-orange-200"
                        : "border-orange-400/20 bg-zinc-800 text-zinc-300 hover:border-orange-400/50"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={form.appliesToProducts.includes(product.id)}
                      onChange={() => toggleProduct(product.id)}
                      className="h-4 w-4 accent-orange-400"
                    />
                    <span className="text-sm font-semibold">{product.name}</span>
                  </label>
                ))}
              </div>
              {form.appliesToProducts.length === 0 && (
                <p className="mt-2 text-xs font-semibold text-orange-400/70">
                  ⚠ No products selected — this will be a universal code valid on all products.
                </p>
              )}
            </div>

            {/* Lifetime + Active toggles */}
            <div className="flex flex-wrap gap-6">
              <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-orange-200">
                <input
                  type="checkbox"
                  checked={form.isLifetime}
                  onChange={(e) => setForm((p) => ({ ...p, isLifetime: e.target.checked }))}
                  className="h-4 w-4 accent-orange-400"
                />
                Lifetime (never expires)
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-orange-200">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))}
                  className="h-4 w-4 accent-orange-400"
                />
                Active
              </label>
            </div>

            {/* Expiry date (shown only if not lifetime) */}
            {!form.isLifetime && (
              <div>
                <label className="mb-1 block text-xs font-bold tracking-widest text-orange-400">EXPIRY DATE</label>
                <input
                  type="date"
                  value={form.expiresAt}
                  onChange={(e) => setForm((p) => ({ ...p, expiresAt: e.target.value }))}
                  className="rounded-lg border border-orange-400/30 bg-zinc-800 px-3 py-2 text-sm font-semibold text-orange-100 focus:border-orange-400 focus:outline-none"
                />
              </div>
            )}

            {formError && (
              <p className="text-sm font-semibold text-red-400">{formError}</p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 rounded-lg bg-orange-500 px-6 py-2.5 text-sm font-bold text-black transition hover:bg-orange-400 disabled:opacity-60"
            >
              {submitting && <Spinner />}
              {submitting ? "Creating…" : "Create & Sync to Stripe"}
            </button>
          </form>
        </div>
      )}

      {/* Codes Table */}
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-orange-400"><Spinner /> Loading…</div>
      ) : codes.length === 0 ? (
        <div className="rounded-xl border border-orange-400/20 bg-zinc-900 px-6 py-12 text-center text-sm font-semibold text-zinc-500">
          No promo codes yet. Create one above.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-orange-400/20 bg-zinc-900">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-orange-400/20 text-left text-xs font-bold tracking-widest text-orange-400">
                <th className="px-4 py-3">CODE</th>
                <th className="px-4 py-3">PROMOTER</th>
                <th className="px-4 py-3">DISCOUNT</th>
                <th className="px-4 py-3">APPLIES TO</th>
                <th className="px-4 py-3">USES</th>
                <th className="px-4 py-3">REVENUE</th>
                <th className="px-4 py-3">EXPIRES</th>
                <th className="px-4 py-3">STATUS</th>
                <th className="px-4 py-3">ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {codes.map((c, i) => (
                <tr key={c.id} className={`border-b border-orange-400/10 ${i % 2 === 0 ? "" : "bg-zinc-800/40"}`}>
                  <td className="px-4 py-3 font-mono font-bold text-orange-300">{c.code}</td>
                  <td className="px-4 py-3 text-zinc-300">{c.promoter}</td>
                  <td className="px-4 py-3 font-semibold text-orange-200">
                    {c.discountType === "percent" ? `${c.discountValue}%` : fmt(c.discountValue)}
                  </td>
                  <td className="px-4 py-3">
                    <ProductTags productIds={c.appliesToProducts} />
                  </td>
                  <td className="px-4 py-3 text-zinc-400">{c.totalUses}</td>
                  <td className="px-4 py-3 text-zinc-400">{fmt(c.totalRevenueCents)}</td>
                  <td className="px-4 py-3 text-zinc-400">
                    {c.isLifetime ? <span className="text-xs text-zinc-500">Never</span> : fmtDate(c.expiresAt)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${c.isActive ? "bg-green-800 text-green-200" : "bg-zinc-700 text-zinc-400"}`}>
                      {c.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleToggle(c.id, c.isActive)}
                        disabled={busy === c.id}
                        className={`rounded px-2 py-1 text-xs font-bold transition disabled:opacity-50 ${c.isActive ? "bg-zinc-700 text-zinc-200 hover:bg-zinc-600" : "bg-green-800 text-green-200 hover:bg-green-700"}`}
                      >
                        {busy === c.id ? <Spinner /> : c.isActive ? "Deactivate" : "Activate"}
                      </button>
                      <button
                        onClick={() => handleDelete(c.id, c.code)}
                        disabled={busy === c.id}
                        className="rounded bg-red-900 px-2 py-1 text-xs font-bold text-red-200 transition hover:bg-red-800 disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Promoter Summary */}
      {promoterRows.length > 0 && (
        <div className="rounded-xl border border-orange-400/20 bg-zinc-900 p-5">
          <h2 className="mb-3 text-base font-extrabold text-orange-400">Promoter Summary</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-orange-400/20 text-left text-xs font-bold tracking-widest text-orange-400">
                <th className="py-2 pr-4">PROMOTER</th>
                <th className="py-2 pr-4">CODES</th>
                <th className="py-2 pr-4">USES</th>
                <th className="py-2">REVENUE</th>
              </tr>
            </thead>
            <tbody>
              {promoterRows.map(([promoter, stats]) => (
                <tr key={promoter} className="border-b border-orange-400/10">
                  <td className="py-2 pr-4 font-semibold text-orange-200">{promoter}</td>
                  <td className="py-2 pr-4 text-zinc-400">{stats.codes}</td>
                  <td className="py-2 pr-4 text-zinc-400">{stats.uses}</td>
                  <td className="py-2 font-semibold text-orange-300">{fmt(stats.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

