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
  unitPriceCents: string;
};

const emptyItem = (): DraftItem => ({
  description: "",
  sku: "",
  quantity: "1",
  unitPriceCents: "0",
});

function formatMoney(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return fallback;
}

export default function InvoiceClient() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customerEmail, setCustomerEmail] = useState("");
  const [taxCents, setTaxCents] = useState("0");
  const [items, setItems] = useState<DraftItem[]>([emptyItem()]);

  const subtotalPreview = useMemo(() => {
    return items.reduce((sum, item) => {
      const quantity = Number(item.quantity || 0);
      const unitPriceCents = Number(item.unitPriceCents || 0);
      if (!Number.isFinite(quantity) || !Number.isFinite(unitPriceCents)) return sum;
      return sum + quantity * unitPriceCents;
    }, 0);
  }, [items]);

  const taxPreview = useMemo(() => {
    const value = Number(taxCents || 0);
    return Number.isFinite(value) ? value : 0;
  }, [taxCents]);

  const totalPreview = subtotalPreview + taxPreview;

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
    try {
      const payload = {
        customerEmail: customerEmail.trim() || null,
        taxCents: Number(taxCents || 0),
        items: items.map((item) => ({
          description: item.description,
          sku: item.sku || null,
          quantity: Number(item.quantity || 0),
          unitPriceCents: Number(item.unitPriceCents || 0),
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
      setTaxCents("0");
      setItems([emptyItem()]);
      await loadInvoices();
    } catch (err) {
      setError(getErrorMessage(err, "Failed to create invoice"));
    }
  }

  return (
    <div className="grid gap-6">
      <section className="admin-card rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Create invoice</h2>
        <div className="mt-4 grid gap-3">
          <label className="grid gap-1 text-sm">
            Customer email (optional)
            <input
              className="rounded-lg border border-slate-200 px-3 py-2"
              value={customerEmail}
              onChange={(event) => setCustomerEmail(event.target.value)}
              placeholder="customer@example.com"
            />
          </label>

          <label className="grid gap-1 text-sm">
            Tax (cents)
            <input
              className="rounded-lg border border-slate-200 px-3 py-2"
              value={taxCents}
              onChange={(event) => setTaxCents(event.target.value)}
              placeholder="0"
            />
          </label>
        </div>

        <div className="mt-4 grid gap-4">
          {items.map((item, index) => (
            <div key={`${index}-${item.sku}`} className="grid gap-2 rounded-xl border border-slate-200 p-4">
              <div className="grid gap-2 sm:grid-cols-4">
                <input
                  className="rounded-lg border border-slate-200 px-3 py-2"
                  placeholder="Description"
                  value={item.description}
                  onChange={(event) => updateItem(index, { description: event.target.value })}
                />
                <input
                  className="rounded-lg border border-slate-200 px-3 py-2"
                  placeholder="SKU (optional)"
                  value={item.sku}
                  onChange={(event) => updateItem(index, { sku: event.target.value })}
                />
                <input
                  className="rounded-lg border border-slate-200 px-3 py-2"
                  placeholder="Qty"
                  value={item.quantity}
                  onChange={(event) => updateItem(index, { quantity: event.target.value })}
                />
                <input
                  className="rounded-lg border border-slate-200 px-3 py-2"
                  placeholder="Unit price (cents)"
                  value={item.unitPriceCents}
                  onChange={(event) => updateItem(index, { unitPriceCents: event.target.value })}
                />
              </div>

              {items.length > 1 ? (
                <button
                  className="w-fit rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
                  onClick={() => removeItem(index)}
                  type="button"
                >
                  Remove line
                </button>
              ) : null}
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-slate-600">
          <span>Subtotal: {formatMoney(subtotalPreview)}</span>
          <span>Tax: {formatMoney(taxPreview)}</span>
          <span className="font-semibold text-slate-800">Total: {formatMoney(totalPreview)}</span>
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium hover:bg-slate-50"
            type="button"
            onClick={addItem}
          >
            Add line item
          </button>
          <button
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            type="button"
            onClick={createInvoice}
          >
            Create invoice
          </button>
          <button
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium hover:bg-slate-50"
            type="button"
            onClick={loadInvoices}
          >
            Refresh list
          </button>
          {loading ? <span className="text-sm text-slate-500">Loading…</span> : null}
        </div>

        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      </section>

      <section className="admin-card rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Recent invoices</h2>
        {invoices.length === 0 ? (
          <p className="mt-4 text-sm text-slate-600">No invoices yet.</p>
        ) : (
          <div className="mt-4 grid gap-4">
            {invoices.map((invoice) => (
              <div key={invoice.id} className="rounded-xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-sm text-slate-500">Invoice</div>
                    <div className="text-base font-semibold">{invoice.id}</div>
                    <div className="text-xs text-slate-500">
                      {new Date(invoice.createdAt).toLocaleString()}
                    </div>
                  </div>
                  <div className="text-sm">
                    <div>Customer: {invoice.customerEmail || "N/A"}</div>
                    <div>Total: {formatMoney(invoice.totalCents)}</div>
                  </div>
                  <button
                    className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium hover:bg-slate-50"
                    type="button"
                    onClick={() => window.open(`/api/admin/invoices/${invoice.id}/pdf`, "_blank")}
                  >
                    Download PDF
                  </button>
                </div>
                <div className="mt-3 grid gap-2 text-sm text-slate-600">
                  {invoice.lineItems.map((item) => (
                    <div key={item.id} className="flex flex-wrap items-center justify-between">
                      <div>
                        {item.description}
                        {item.sku ? <span className="text-slate-400"> [{item.sku}]</span> : null}
                      </div>
                      <div>
                        {item.quantity} × {formatMoney(item.unitPriceCents)} = {formatMoney(item.totalCents)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
