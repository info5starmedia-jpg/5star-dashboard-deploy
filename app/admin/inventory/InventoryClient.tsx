"use client";

import { useEffect, useMemo, useState } from "react";

type Item = {
  id: string;
  name: string;
  sku: string;
  quantity: number;
  priceCents: number;
  costCents: number;
  content: string | null;
};

type Metrics = {
  totalUnits: number;
  totalValueCents: number;
  totalCostCents: number;
  profitCents: number;
};

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
  return data as T;
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return fallback;
}

function dollars(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function InventoryClient() {
  const [items, setItems] = useState<Item[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Add form state
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [priceInput, setPriceInput] = useState("");
  const [costInput, setCostInput] = useState("");
  const [content, setContent] = useState(""); // paste proxy lines here

  // Auto-sync quantity from content lines
  const contentLineCount = content.trim() ? content.trim().split("\n").filter(l => l.trim()).length : 0;

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFields, setEditFields] = useState<Partial<Item>>({});
  const [editContent, setEditContent] = useState("");

  const effectiveQty = contentLineCount > 0 ? contentLineCount : Number(quantity);
  const canSubmit = useMemo(() => {
    const qty = contentLineCount > 0 ? contentLineCount : Number(quantity);
    return (
      name.trim() &&
      sku.trim() &&
      Number.isFinite(qty) && qty >= 0 &&
      Number.isFinite(Number(priceInput)) && Number(priceInput) >= 0 &&
      Number.isFinite(Number(costInput)) && Number(costInput) >= 0
    );
  }, [name, sku, quantity, priceInput, costInput, contentLineCount]);

  async function refresh() {
    setErr(null);
    setLoading(true);
    try {
      const [data, metricsData] = await Promise.all([
        api<{ items: Item[] }>("/api/admin/inventory"),
        api<{ metrics: Metrics }>("/api/admin/metrics/inventory"),
      ]);
      setItems(data.items || []);
      setMetrics(metricsData.metrics ?? null);
    } catch (error: unknown) {
      setErr(getErrorMessage(error, "Failed to load inventory"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(); }, []);

  async function createItem() {
    setErr(null);
    try {
      await api("/api/admin/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          sku: sku.trim(),
          quantity: effectiveQty,
          priceCents: Math.round(Number(priceInput) * 100),
          costCents: Math.round(Number(costInput) * 100),
          ...(content.trim() ? { content: content.trim() } : {}),
        }),
      });
      setName(""); setSku(""); setQuantity("1"); setPriceInput(""); setCostInput(""); setContent("");
      await refresh();
    } catch (error: unknown) {
      setErr(getErrorMessage(error, "Create failed"));
    }
  }

  function startEdit(item: Item) {
    setEditingId(item.id);
    setEditFields({ name: item.name, quantity: item.quantity, priceCents: item.priceCents, costCents: item.costCents });
    setEditContent(item.content ?? "");
  }

  async function saveEdit(id: string) {
    setErr(null);
    try {
      await api(`/api/admin/inventory/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...editFields,
          content: editContent.trim() || null,
        }),
      });
      setEditingId(null);
      setEditFields({});
      setEditContent("");
      await refresh();
    } catch (error: unknown) {
      setErr(getErrorMessage(error, "Update failed"));
    }
  }

  async function del(id: string) {
    setErr(null);
    try {
      await api(`/api/admin/inventory/${id}`, { method: "DELETE" });
      await refresh();
    } catch (error: unknown) {
      setErr(getErrorMessage(error, "Delete failed"));
    }
  }

  return (
    <div className="grid gap-6">

      {/* Metrics */}
      <div className="rounded-2xl border border-orange-400/30 bg-zinc-900 p-6 shadow-sm">
        <h3 className="text-lg font-bold text-orange-400">Inventory Metrics</h3>
        {metrics ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-4">
            {[
              { label: "Total Units", value: metrics.totalUnits.toLocaleString(), accent: false },
              { label: "Inventory Value", value: dollars(metrics.totalValueCents), accent: false },
              { label: "Total Cost", value: dollars(metrics.totalCostCents), accent: false },
              { label: "Est. Profit", value: dollars(metrics.profitCents), accent: true },
            ].map((m) => (
              <div key={m.label} className={`rounded-xl p-4 ${m.accent ? "bg-emerald-900/30" : "bg-zinc-800"}`}>
                <div className={`text-xs font-bold uppercase tracking-wide ${m.accent ? "text-emerald-400" : "text-orange-400"}`}>{m.label}</div>
                <div className={`mt-1 text-2xl font-extrabold ${m.accent ? "text-emerald-400" : "text-orange-400"}`}>{m.value}</div>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm font-semibold text-orange-300">No metrics yet.</p>
        )}
      </div>

      {/* Add Item */}
      <div className="rounded-2xl border border-orange-400/30 bg-zinc-900 p-6 shadow-sm">
        <h3 className="text-lg font-bold text-orange-400">Add Item</h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-5">
          {[
            { placeholder: "Name", value: name, onChange: setName },
            { placeholder: "SKU", value: sku, onChange: setSku },
          ].map((f) => (
            <input key={f.placeholder} placeholder={f.placeholder} value={f.value}
              onChange={(e) => f.onChange(e.target.value)}
              className="rounded-lg border-2 border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm font-semibold text-orange-400 placeholder:text-orange-400/40 placeholder:font-medium outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20" />
          ))}
          <input type="number" min="0" placeholder="Qty" value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="rounded-lg border-2 border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm font-semibold text-orange-400 placeholder:text-orange-400/40 placeholder:font-medium outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20" />
          <input type="number" min="0" step="0.01" placeholder="Unit Price ($)" value={priceInput}
            onChange={(e) => setPriceInput(e.target.value)} title="e.g. 5.00 = $5.00"
            className="rounded-lg border-2 border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm font-semibold text-orange-400 placeholder:text-orange-400/40 placeholder:font-medium outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20" />
          <input type="number" min="0" step="0.01" placeholder="Cost ($)" value={costInput}
            onChange={(e) => setCostInput(e.target.value)} title="e.g. 2.50 = $2.50"
            className="rounded-lg border-2 border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm font-semibold text-orange-400 placeholder:text-orange-400/40 placeholder:font-medium outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20" />
        </div>
        {/* Content textarea (proxy/ISP lines) */}
        <div className="mt-3">
          <label className="mb-1.5 block text-sm font-semibold text-orange-400">
            Content — paste lines (one per line, optional) — proxy lines, server creds, account info, etc.
          </label>
          <textarea
            rows={4}
            placeholder={"ip:port:user:pass\nip:port:user:pass\n..."}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full rounded-lg border-2 border-zinc-700 bg-zinc-800 px-3 py-2.5 font-mono text-sm font-semibold text-orange-400 placeholder:text-orange-400/40 placeholder:font-medium outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20"
          />
          {contentLineCount > 0 && (
            <p className="mt-1 text-sm font-medium text-orange-300">
              {contentLineCount} line{contentLineCount !== 1 ? "s" : ""} detected — quantity will auto-set to <strong>{contentLineCount}</strong>
            </p>
          )}
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button disabled={!canSubmit} onClick={createItem}
            className="rounded-lg bg-orange-500 px-5 py-2.5 text-sm font-bold text-black hover:bg-orange-400 disabled:opacity-40">
            Add stock
          </button>
          <button onClick={refresh}
            className="rounded-lg border-2 border-orange-400/40 bg-zinc-800 px-5 py-2.5 text-sm font-bold text-orange-400 hover:bg-zinc-700">
            Refresh
          </button>
          {loading && (
            <div className="flex items-center gap-2 text-sm font-semibold text-orange-400">
              <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-orange-400/30 border-t-orange-400" />
              Loading...
            </div>
          )}
        </div>
        {err && (
          <div className="mt-4 rounded-lg border border-red-500/40 bg-zinc-900 px-4 py-3 text-sm font-semibold text-red-400">{err}</div>
        )}
      </div>

      {/* Items List */}
      <div className="rounded-2xl border border-orange-400/30 bg-zinc-900 p-6 shadow-sm">
        <h3 className="text-lg font-bold text-orange-400">
          Items {items.length > 0 && <span className="font-semibold text-orange-300">({items.length})</span>}
        </h3>
        {items.length === 0 ? (
          <p className="mt-3 text-sm font-semibold text-orange-300">No items yet.</p>
        ) : (
          <div className="mt-4 grid gap-3">
            {items.map((it) => (
              <div key={it.id} className="rounded-xl border border-orange-400/20 bg-zinc-800 p-4 transition hover:border-orange-400/40">
                {editingId === it.id ? (
                  <div className="grid gap-3">
                    <div className="grid gap-3 sm:grid-cols-4">
                      <input type="text" placeholder="Name" value={editFields.name ?? ""}
                        onChange={(e) => setEditFields({ ...editFields, name: e.target.value })}
                        className="rounded-lg border-2 border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm font-semibold text-orange-400 placeholder:text-orange-400/40 placeholder:font-medium outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20" />
                      <input type="number" min="0" placeholder="Qty" value={String(editFields.quantity ?? 0)}
                        onChange={(e) => setEditFields({ ...editFields, quantity: Number(e.target.value) })}
                        className="rounded-lg border-2 border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm font-semibold text-orange-400 placeholder:text-orange-400/40 placeholder:font-medium outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20" />
                      <input type="number" min="0" step="0.01" placeholder="Unit Price ($)"
                        value={String((editFields.priceCents ?? 0) / 100)}
                        onChange={(e) => setEditFields({ ...editFields, priceCents: Math.round(Number(e.target.value) * 100) })}
                        className="rounded-lg border-2 border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm font-semibold text-orange-400 placeholder:text-orange-400/40 placeholder:font-medium outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20" />
                      <input type="number" min="0" step="0.01" placeholder="Cost ($)"
                        value={String((editFields.costCents ?? 0) / 100)}
                        onChange={(e) => setEditFields({ ...editFields, costCents: Math.round(Number(e.target.value) * 100) })}
                        className="rounded-lg border-2 border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm font-semibold text-orange-400 placeholder:text-orange-400/40 placeholder:font-medium outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20" />
                    </div>
                    {/* Edit content textarea */}
                    <div>
                      <label className="mb-1.5 block text-sm font-semibold text-orange-400">Content lines (one per line)</label>
                      <textarea
                        rows={3}
                        placeholder="ip:port:user:pass (one per line)"
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        className="w-full rounded-lg border-2 border-zinc-700 bg-zinc-800 px-3 py-2.5 font-mono text-sm font-semibold text-orange-400 placeholder:text-orange-400/40 placeholder:font-medium outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20"
                      />
                      {editContent.trim() && (
                        <p className="mt-1 text-sm font-medium text-orange-300">
                          {editContent.trim().split("\n").filter(l => l.trim()).length} line(s) — quantity will auto-sync on save
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => saveEdit(it.id)}
                        className="rounded-lg bg-orange-500 px-3 py-1.5 text-sm font-bold text-black hover:bg-orange-400">
                        Save
                      </button>
                      <button onClick={() => { setEditingId(null); setEditFields({}); setEditContent(""); }}
                        className="rounded-lg border-2 border-orange-400/40 bg-zinc-800 px-3 py-1.5 text-sm font-bold text-orange-400 hover:bg-zinc-700">
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="text-base font-bold text-orange-400">{it.name}</div>
                      <div className="mt-1 flex flex-wrap gap-x-4 text-sm font-medium text-orange-300">
                        <span>SKU: <strong>{it.sku}</strong></span>
                        <span className={it.quantity <= 5 ? "font-bold text-amber-400" : ""}>Qty: <strong>{it.quantity}</strong></span>
                        <span>Price: <strong>{dollars(it.priceCents)}</strong> per unit</span>
                        <span>Cost: <strong>{dollars(it.costCents)}</strong> per unit</span>
                        <span className="font-bold text-emerald-400">Margin: {dollars(it.priceCents - it.costCents)}</span>
                        {it.content && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-blue-600/40 bg-blue-900/30 px-2 py-0.5 text-blue-300">
                            📦 {it.content.split("\n").filter(l => l.trim()).length} lines
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <button onClick={() => startEdit(it)}
                        className="rounded-lg border-2 border-orange-400/40 bg-zinc-800 px-3 py-1.5 text-xs font-bold text-orange-400 hover:bg-zinc-700">
                        Edit
                      </button>
                      <button onClick={() => del(it.id)}
                        className="rounded-lg border border-red-500/40 bg-red-900/30 px-3 py-1.5 text-xs font-bold text-red-400 hover:bg-red-900/50">
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
