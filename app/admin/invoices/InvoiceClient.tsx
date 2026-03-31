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

// Draft items use dollar strings for human-friendly input, converted to cents on submit
type DraftItem = {
  description: string;
  sku: string;
  quantity: string;
  unitPriceDollars: string; // user types "$12.99" → we store "12.99" → submit 1299 cents
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
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    cents / 100
  );
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return fallback;
}

const STATUS_STYLES: Record<string, string> = {
  issued:    "bg-blue-50 text-blue-700 border-blue-200",
  void:      "bg-zinc-100 text-zinc-500 border-zinc-200",
  cancelled: "bg-red-50 text-red-600 border-red-200",
};

function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_STYLES[status] ?? "bg-zinc-100 text-zinc-500 border-zinc-200";
  return (
    <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${cls}`}>
      {status}
    </span>
  );
}

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

  useEffect(() => {
    loadInvoices();
  }, []);

  function updateItem(index: number, patch: Partial<DraftItem>) {
    setItems((prev) => prev.map((item, idx) => (idx === index ? { ...item, ...patch } : item)));
  }

  function addItem() {
    setItems((prev) => [...prev, emptyItem()]);
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, idx) => idx !== index));
  }

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

      setCustomerEmail("");
      setTaxDollars("0.00");
      setItems([emptyItem()]);
      await loadInvoices();
    } catch (err) {
      setError(getErrorMessage(err, "Failed to create invoice"));
    } finally {
      setCreating(false);
    }
  }

  async function updateInvoiceStatus(id: string, status: "void" | "cancelled") {
    const label = status === "void" ? "void" : "cancel";
    if (!confirm(`Are you sure you want to ${label} invoice ${id}? This cannot be undone.`))
      return;

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
      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-900">Create Invoice</h2>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1 text-sm font-medium text-zinc-700">
            Customer email
            <input
              className="rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-300"
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
              placeholder="customer@example.com"
              type="email"
            />
          </label>

          <label className="grid gap-1 text-sm font-medium text-zinc-700">
            Tax ($)
            <input
              className="rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-300"
              value={taxDollars}
              onChange={(e) => setTaxDollars(e.target.value)}
              placeholder="0.00"
              type="number"
              min="0"
              step="0.01"
            />
          </label>
        </div>

        {/* Line items */}
        <div className="mt-5 space-y-3">
          <p className="text-sm font-medium text-zinc-700">Line Items</p>
          {items.map((item, index) => (
            <div
              key={index}
              className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 space-y-3"
            >
              <div className="grid gap-3 sm:grid-cols-4">
                <div className="sm:col-span-2 grid gap-1">
                  <label className="text-xs font-medium text-zinc-500">Description *</label>
                  <input
                    className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-300"
                    placeholder="e.g. Monthly service fee"
                    value={item.description}
                    onChange={(e) => updateItem(index, { description: e.target.value })}
                  />
                </div>
                <div className="grid gap-1">
                  <label className="text-xs font-medium text-zinc-500">SKU (optional)</label>
                  <input
                    className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-300"
                    placeholder="SKU-001"
                    value={item.sku}
                    onChange={(e) => updateItem(index, { sku: e.target.value })}
                  />
                </div>
                <div className="grid gap-1">
                  <label className="text-xs font-medium text-zinc-500">Qty</label>
                  <input
                    className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-300"
                    placeholder="1"
                    value={item.quantity}
                    onChange={(e) => updateItem(index, { quantity: e.target.value })}
                    type="number"
                    min="1"
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-1">
                  <label className="text-xs font-medium text-zinc-500">Unit Price ($)</label>
                  <input
                    className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-300"
                    placeholder="0.00"
                    value={item.unitPriceDollars}
                    onChange={(e) => updateItem(index, { unitPriceDollars: e.target.value })}
                    type="number"
                    min="0"
                    step="0.01"
                  />
                </div>
                <div className="flex items-end">
                  <p className="text-sm text-zinc-500">
                    Line total:{" "}
                    <span className="font-semibold text-zinc-800">
                      {formatMoney(Number(item.quantity || 0) * dollarsToCents(item.unitPriceDollars))}
                    </span>
                  </p>
                </div>
              </div>

              {items.length > 1 && (
                <button
                  className="text-xs text-red-500 hover:text-red-700"
                  onClick={() => removeItem(index)}
                  type="button"
                >
                  Remove line
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Totals preview */}
        <div className="mt-4 flex flex-wrap items-center gap-4 rounded-xl border border-zinc-100 bg-zinc-50 px-4 py-3 text-sm">
          <span className="text-zinc-600">
            Subtotal: <span className="font-medium text-zinc-800">{formatMoney(subtotalPreviewCents)}</span>
          </span>
          <span className="text-zinc-400">+</span>
          <span className="text-zinc-600">
            Tax: <span className="font-medium text-zinc-800">{formatMoney(taxPreviewCents)}</span>
          </span>
          <span className="text-zinc-400">=</span>
          <span className="font-bold text-zinc-900 text-base">
            Total: {formatMoney(totalPreviewCents)}
          </span>
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium hover:bg-zinc-50"
            type="button"
            onClick={addItem}
          >
            + Add line item
          </button>
          <button
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
            type="button"
            onClick={createInvoice}
            disabled={creating}
          >
            {creating ? "Creating…" : "Create Invoice"}
          </button>
          <button
            className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium hover:bg-zinc-50"
            type="button"
            onClick={loadInvoices}
            disabled={loading}
          >
            {loading ? "Loading…" : "Refresh"}
          </button>
        </div>

        {error && (
          <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}
      </section>

      {/* Invoice list */}
      <section className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <div className="border-b border-zinc-100 px-6 py-4">
          <h2 className="text-lg font-semibold text-zinc-900">
            Recent Invoices{" "}
            {invoices.length > 0 && (
              <span className="ml-2 text-sm font-normal text-zinc-500">({invoices.length})</span>
            )}
          </h2>
        </div>

        {invoices.length === 0 ? (
          <p className="px-6 py-8 text-sm text-zinc-500">No invoices yet.</p>
        ) : (
          <div className="divide-y divide-zinc-100">
            {invoices.map((invoice) => {
              const isIssued = invoice.status === "issued";
              const isBusy = !!statusLoading[invoice.id];
              const shortId = invoice.id.slice(-8).toUpperCase();

              return (
                <div key={invoice.id} className="p-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-semibold text-zinc-800">
                          #{shortId}
                        </span>
                        <StatusBadge status={invoice.status} />
                      </div>
                      <p className="mt-0.5 text-xs text-zinc-400">
                        {new Date(invoice.createdAt).toLocaleString()} · by {invoice.createdByEmail}
                      </p>
                      {invoice.customerEmail && (
                        <p className="mt-1 text-sm text-zinc-600">{invoice.customerEmail}</p>
                      )}
                    </div>

                    <div className="text-right">
                      <p className="text-xl font-bold text-zinc-900">
                        {formatMoney(invoice.totalCents)}
                      </p>
                      {invoice.taxCents > 0 && (
                        <p className="text-xs text-zinc-400">
                          incl. {formatMoney(invoice.taxCents)} tax
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Line items */}
                  <div className="mt-3 space-y-1 text-sm text-zinc-600">
                    {invoice.lineItems.map((item) => (
                      <div key={item.id} className="flex flex-wrap justify-between gap-2">
                        <span>
                          {item.description}
                          {item.sku && (
                            <span className="ml-1 text-zinc-400">[{item.sku}]</span>
                          )}
                        </span>
                        <span className="text-zinc-800">
                          {item.quantity} × {formatMoney(item.unitPriceCents)} ={" "}
                          <span className="font-medium">{formatMoney(item.totalCents)}</span>
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Actions */}
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium hover:bg-zinc-50"
                      type="button"
                      onClick={() =>
                        window.open(`/api/admin/invoices/${invoice.id}/pdf`, "_blank")
                      }
                    >
                      Download PDF
                    </button>

                    {isIssued && (
                      <>
                        <button
                          className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-50"
                          type="button"
                          disabled={isBusy}
                          onClick={() => updateInvoiceStatus(invoice.id, "void")}
                        >
                          {isBusy ? "…" : "Void"}
                        </button>
                        <button
                          className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                          type="button"
                          disabled={isBusy}
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
