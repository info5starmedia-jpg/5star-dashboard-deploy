"use client";

import { useEffect, useMemo, useState } from "react";

type InvoiceLineItem = {
  id: string;
  description: string;
  sku: string | null;
  quantity: number;
  unitPriceCents: number;
  totalCents: number;
};

type Invoice = {
  id: string;
  createdAt: string;
  createdByEmail: string;
  customerEmail: string | null;
  status: string;
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  lineItems: InvoiceLineItem[];
};

type DraftItem = {
  description: string;
  sku: string;
  quantity: string;
  unitPriceDollars: string;
};

const emptyItem = (): DraftItem => ({
  description: "",
  sku: "",
  quantity: "1",
  unitPriceDollars: "0.00",
});

function dollarsToCents(s: string): number {
  const n = parseFloat(s.replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return fallback;
}

const STATUS_STYLES: Record<string, string> = {
  issued:    "bg-blue-900/40 text-blue-300 border-blue-700",
  void:      "bg-zinc-800 text-orange-300/60 border-orange-400/20",
  cancelled: "bg-red-900/40 text-red-300 border-red-700",
};

function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_STYLES[status] ?? "bg-zinc-800 text-orange-300 border-orange-400/20";
  return (
    <span className={`rounded-full border px-2 py-0.5 text-xs font-bold ${cls}`}>
      {status}
    </span>
  );
}

const INPUT = "rounded-lg border-2 border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm font-semibold text-orange-400 placeholder:text-orange-400/40 focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 w-full";

export default function InvoiceClient() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customerEmail, setCustomerEmail] = useState("");
  const [taxDollars, setTaxDollars] = useState("0.00");
  const [items, setItems] = useState<DraftItem[]>([emptyItem()]);
  const [statusLoading, setStatusLoading] = useState<Record<string, boolean>>({});
  const [creating, setCreating] = useState(false);

  const subtotalPreviewCents = useMemo(() => {
    return items.reduce((sum, item) => {
      const qty = Number(item.quantity || 0);
      const price = dollarsToCents(item.unitPriceDollars);
      if (!Number.isFinite(qty)) return sum;
      return sum + qty * price;
    }, 0);
  }, [items]);

  const taxPreviewCents = useMemo(() => dollarsToCents(taxDollars), [taxDollars]);
  const totalPreviewCents = subtotalPreviewCents + taxPreviewCents;

  async function loadInvoices() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/invoices", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to load invoices");
      setInvoices(json.invoices ?? []);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to load invoices"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadInvoices(); }, []);

  function updateItem(index: number, patch: Partial<DraftItem>) {
    setItems((prev) => prev.map((item, idx) => (idx === index ? { ...item, ...patch } : item)));
  }

  function addItem() { setItems((prev) => [...prev, emptyItem()]); }
  function removeItem(index: number) { setItems((prev) => prev.filter((_, idx) => idx !== index)); }

  async function createInvoice() {
    setError(null);
    setCreating(true);
    try {
      const payload = {
        customerEmail: customerEmail.trim() || null,
        taxCents: dollarsToCents(taxDollars),
        items: items.map((item) => ({
          description: item.description,
          sku: item.sku || null,
          quantity: Number(item.quantity || 0),
          unitPriceCents: dollarsToCents(item.unitPriceDollars),
        })),
      };
      const res = await fetch("/api/admin/invoices", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to create invoice");
      setCustomerEmail(""); setTaxDollars("0.00"); setItems([emptyItem()]);
      await loadInvoices();
    } catch (err) {
      setError(getErrorMessage(err, "Failed to create invoice"));
    } finally {
      setCreating(false);
    }
  }

  async function updateInvoiceStatus(id: string, status: "void" | "cancelled") {
    const label = status === "void" ? "void" : "cancel";
    if (!confirm(`Are you sure you want to ${label} invoice ${id}? This cannot be undone.`)) return;
    setStatusLoading((prev) => ({ ...prev, [id]: true }));
    setError(null);
    try {
      const res = await fetch(`/api/admin/invoices/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || `Failed to ${label} invoice`);
      setInvoices((prev) =>
        prev.map((inv) => (inv.id === id ? { ...inv, status: json.invoice.status } : inv))
      );
    } catch (err) {
      setError(getErrorMessage(err, `Failed to ${label} invoice`));
    } finally {
      setStatusLoading((prev) => ({ ...prev, [id]: false }));
    }
  }

  return (
    <div className="space-y-6">
      {/* Create invoice form */}
      <section className="rounded-2xl border border-orange-400/30 bg-zinc-900 p-6 shadow-sm">
        <h2 className="text-lg font-bold text-orange-400">Create Invoice</h2>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1.5 text-sm font-bold text-orange-400">
            Customer email
            <input className={INPUT} value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
              placeholder="customer@example.com" type="email" />
          </label>
          <label className="grid gap-1.5 text-sm font-bold text-orange-400">
            Tax ($)
            <input className={INPUT} value={taxDollars}
              onChange={(e) => setTaxDollars(e.target.value)}
              placeholder="0.00" type="number" min="0" step="0.01" />
          </label>
        </div>

        {/* Line items */}
        <div className="mt-5 space-y-3">
          <p className="text-sm font-bold text-orange-400">Line Items</p>
          {items.map((item, index) => (
            <div key={index} className="rounded-xl border border-orange-400/20 bg-zinc-800 p-4 space-y-3">
              <div className="grid gap-3 sm:grid-cols-4">
                <div className="sm:col-span-2 grid gap-1.5">
                  <label className="text-xs font-bold text-orange-400">Description *</label>
                  <input className={INPUT} placeholder="e.g. Monthly service fee"
                    value={item.description} onChange={(e) => updateItem(index, { description: e.target.value })} />
                </div>
                <div className="grid gap-1.5">
                  <label className="text-xs font-bold text-orange-400">SKU (optional)</label>
                  <input className={INPUT} placeholder="SKU-001"
                    value={item.sku} onChange={(e) => updateItem(index, { sku: e.target.value })} />
                </div>
                <div className="grid gap-1.5">
                  <label className="text-xs font-bold text-orange-400">Qty</label>
                  <input className={INPUT} placeholder="1" value={item.quantity}
                    onChange={(e) => updateItem(index, { quantity: e.target.value })}
                    type="number" min="1" />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <label className="text-xs font-bold text-orange-400">Unit Price ($)</label>
                  <input className={INPUT} placeholder="0.00" value={item.unitPriceDollars}
                    onChange={(e) => updateItem(index, { unitPriceDollars: e.target.value })}
                    type="number" min="0" step="0.01" />
                </div>
                <div className="flex items-end">
                  <p className="text-sm font-semibold text-orange-300">
                    Line total:{" "}
                    <span className="font-bold text-orange-400">
                      {formatMoney(Number(item.quantity || 0) * dollarsToCents(item.unitPriceDollars))}
                    </span>
                  </p>
                </div>
              </div>

              {items.length > 1 && (
                <button className="text-xs font-bold text-red-400 hover:text-red-300"
                  onClick={() => removeItem(index)} type="button">
                  Remove line
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Totals preview */}
        <div className="mt-4 flex flex-wrap items-center gap-4 rounded-xl border border-orange-400/20 bg-zinc-800 px-4 py-3 text-sm">
          <span className="font-semibold text-orange-300">
            Subtotal: <span className="font-bold text-orange-400">{formatMoney(subtotalPreviewCents)}</span>
          </span>
          <span className="text-orange-400">+</span>
          <span className="font-semibold text-orange-300">
            Tax: <span className="font-bold text-orange-400">{formatMoney(taxPreviewCents)}</span>
          </span>
          <span className="text-orange-400">=</span>
          <span className="text-base font-extrabold text-orange-400">
            Total: {formatMoney(totalPreviewCents)}
          </span>
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <button className="rounded-lg border-2 border-orange-400/40 bg-zinc-800 px-4 py-2.5 text-sm font-bold text-orange-400 hover:bg-zinc-700"
            type="button" onClick={addItem}>
            + Add line item
          </button>
          <button className="rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-bold text-black hover:bg-orange-400 disabled:opacity-50"
            type="button" onClick={createInvoice} disabled={creating}>
            {creating ? "Creating…" : "Create Invoice"}
          </button>
          <button className="rounded-lg border-2 border-orange-400/40 bg-zinc-800 px-4 py-2.5 text-sm font-bold text-orange-400 hover:bg-zinc-700"
            type="button" onClick={loadInvoices} disabled={loading}>
            {loading ? "Loading…" : "Refresh"}
          </button>
        </div>

        {error && (
          <div className="mt-3 rounded-xl border border-red-500/40 bg-zinc-900 px-4 py-3 text-sm font-semibold text-red-400">
            {error}
          </div>
        )}
      </section>

      {/* Invoice list */}
      <section className="rounded-2xl border border-orange-400/30 bg-zinc-900 shadow-sm">
        <div className="border-b border-orange-400/20 px-6 py-4">
          <h2 className="text-lg font-bold text-orange-400">
            Recent Invoices{" "}
            {invoices.length > 0 && (
              <span className="ml-2 text-sm font-semibold text-orange-300">({invoices.length})</span>
            )}
          </h2>
        </div>

        {invoices.length === 0 ? (
          <p className="px-6 py-8 text-sm font-semibold text-orange-300">No invoices yet.</p>
        ) : (
          <div className="divide-y divide-orange-400/10">
            {invoices.map((invoice) => {
              const isIssued = invoice.status === "issued";
              const isBusy = !!statusLoading[invoice.id];
              const shortId = invoice.id.slice(-8).toUpperCase();

              return (
                <div key={invoice.id} className="p-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-bold text-orange-400">#{shortId}</span>
                        <StatusBadge status={invoice.status} />
                      </div>
                      <p className="mt-0.5 text-xs font-medium text-orange-300">
                        {new Date(invoice.createdAt).toLocaleString()} · by {invoice.createdByEmail}
                      </p>
                      {invoice.customerEmail && (
                        <p className="mt-1 text-sm font-semibold text-orange-400">{invoice.customerEmail}</p>
                      )}
                    </div>

                    <div className="text-right">
                      <p className="text-xl font-extrabold text-orange-400">
                        {formatMoney(invoice.totalCents)}
                      </p>
                      {invoice.taxCents > 0 && (
                        <p className="text-xs font-medium text-orange-300">
                          incl. {formatMoney(invoice.taxCents)} tax
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Line items */}
                  <div className="mt-3 space-y-1 text-sm font-medium text-orange-300">
                    {invoice.lineItems.map((item) => (
                      <div key={item.id} className="flex flex-wrap justify-between gap-2">
                        <span>
                          {item.description}
                          {item.sku && <span className="ml-1 text-orange-400/60">[{item.sku}]</span>}
                        </span>
                        <span className="font-bold text-orange-400">
                          {item.quantity} × {formatMoney(item.unitPriceCents)} ={" "}
                          {formatMoney(item.totalCents)}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Actions */}
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      className="rounded-lg border-2 border-orange-400/40 bg-zinc-800 px-3 py-1.5 text-xs font-bold text-orange-400 hover:bg-zinc-700"
                      type="button"
                      onClick={() => window.open(`/api/admin/invoices/${invoice.id}/pdf`, "_blank")}
                    >
                      Download PDF
                    </button>

                    {isIssued && (
                      <>
                        <button
                          className="rounded-lg border border-orange-400/30 bg-zinc-800 px-3 py-1.5 text-xs font-bold text-orange-300 hover:bg-zinc-700 disabled:opacity-50"
                          type="button" disabled={isBusy}
                          onClick={() => updateInvoiceStatus(invoice.id, "void")}
                        >
                          {isBusy ? "…" : "Void"}
                        </button>
                        <button
                          className="rounded-lg border border-red-500/40 bg-red-900/30 px-3 py-1.5 text-xs font-bold text-red-400 hover:bg-red-900/50 disabled:opacity-50"
                          type="button" disabled={isBusy}
                          onClick={() => updateInvoiceStatus(invoice.id, "cancelled")}
                        >
                          {isBusy ? "…" : "Cancel"}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
