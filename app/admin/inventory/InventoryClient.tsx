"use client";

import { useEffect, useMemo, useState } from "react";
import { INVENTORY_CATEGORIES, getInventoryCategory } from "@/lib/constants";

type Item = {
  id: string;
  name: string;
  subtitle: string | null;
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

const INPUT_CLASS =
  "rounded-lg border-2 border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm font-semibold text-orange-400 placeholder:text-orange-400/40 placeholder:font-medium outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20";

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

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function InventoryClient() {
  const [items, setItems] = useState<Item[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Add form state
  const [categoryKey, setCategoryKey] = useState<string>(INVENTORY_CATEGORIES[0].key);
  const [skuTouched, setSkuTouched] = useState(false);
  const [name, setName] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [sku, setSku] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [priceInput, setPriceInput] = useState("");
  const [costInput, setCostInput] = useState("");
  const [content, setContent] = useState(""); // paste delivery lines here (proxy lines, creds, etc.)

  // Auto-sync quantity from content lines
  const contentLineCount = content.trim() ? content.trim().split("\n").filter((l) => l.trim()).length : 0;

  const category = getInventoryCategory(categoryKey);
  const existingItem = useMemo(
    () => (category.sku ? items.find((i) => i.sku === category.sku) ?? null : null),
    [items, category.sku]
  );

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFields, setEditFields] = useState<Partial<Item>>({});
  const [editContent, setEditContent] = useState("");

  // Switching category: freeform categories (no fixed SKU) start blank.
  // Pooled categories are filled in by the effect below, which also reacts
  // to `items` so it can show/reuse whatever is already in stock.
  useEffect(() => {
    setSkuTouched(false);
    setQuantity("1");
    if (!category.sku) {
      setName("");
      setSku("");
      setSubtitle("");
      setPriceInput("");
      setCostInput("");
      setContent("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryKey]);

  useEffect(() => {
    if (!category.sku) return;
    const match = items.find((i) => i.sku === category.sku) ?? null;
    setName(match ? match.name : category.defaultName);
    setSku(category.sku);
    setSubtitle(match?.subtitle ?? "");
    setPriceInput(match ? String(match.priceCents / 100) : "");
    setCostInput(match ? String(match.costCents / 100) : "");
    setContent(match?.content ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryKey, items]);

  function handleNameChange(value: string) {
    setName(value);
    if (!category.sku && !skuTouched) {
      setSku(slugify(value));
    }
  }

  function handleSkuChange(value: string) {
    setSku(value);
    if (!category.sku) setSkuTouched(true);
  }

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

  async function submitAdd() {
    setErr(null);
    try {
      const priceCents = Math.round(Number(priceInput) * 100);
      const costCents = Math.round(Number(costInput) * 100);
      const trimmedContent = content.trim();
      if (existingItem) {
        // Restock: reuse the pooled SKU, add to its existing quantity instead
        // of creating a duplicate row.
        await api(`/api/admin/inventory/${existingItem.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            subtitle: category.hasSubtitle ? subtitle.trim() : undefined,
            quantity: existingItem.quantity + Math.floor(effectiveQty),
            priceCents,
            costCents,
            ...(trimmedContent ? { content: trimmedContent } : {}),
          }),
        });
      } else {
        await api("/api/admin/inventory", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            subtitle: category.hasSubtitle ? subtitle.trim() : undefined,
            sku: sku.trim(),
            quantity: effectiveQty,
            priceCents,
            costCents,
            ...(trimmedContent ? { content: trimmedContent } : {}),
          }),
        });
      }
      setQuantity("1");
      setContent("");
      await refresh();
    } catch (error: unknown) {
      setErr(getErrorMessage(error, existingItem ? "Restock failed" : "Create failed"));
    }
  }

  function startEdit(item: Item) {
    setEditingId(item.id);
    setEditFields({
      name: item.name,
      subtitle: item.subtitle ?? "",
      quantity: item.quantity,
      priceCents: item.priceCents,
      costCents: item.costCents,
    });
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
        <div className="mt-4 grid gap-3 sm:grid-cols-6">
          <select
            value={categoryKey}
            onChange={(e) => setCategoryKey(e.target.value)}
            className={INPUT_CLASS}
          >
            {INVENTORY_CATEGORIES.map((c) => (
              <option key={c.key} value={c.key}>{c.label}</option>
            ))}
          </select>

          <input placeholder="Name" value={name} onChange={(e) => handleNameChange(e.target.value)}
            className={INPUT_CLASS} />

          <input placeholder="SKU" value={sku} disabled={category.sku !== null}
            onChange={(e) => handleSkuChange(e.target.value)}
            className={`${INPUT_CLASS} disabled:bg-zinc-900 disabled:text-orange-400/40`} />

          {category.hasSubtitle && (
            <input placeholder="Subtitle" value={subtitle} onChange={(e) => setSubtitle(e.target.value)}
              className={INPUT_CLASS} />
          )}

          <input type="number" min="0" placeholder="Qty" value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className={INPUT_CLASS} />
          <input type="number" min="0" step="0.01" placeholder="Unit Price ($)" value={priceInput}
            onChange={(e) => setPriceInput(e.target.value)} title="e.g. 5.00 = $5.00"
            className={INPUT_CLASS} />
          <input type="number" min="0" step="0.01" placeholder="Cost ($)" value={costInput}
            onChange={(e) => setCostInput(e.target.value)} title="e.g. 2.50 = $2.50"
            className={INPUT_CLASS} />
        </div>

        {/* Content textarea (delivery lines: proxy lines, creds, account info, etc.) */}
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

        {existingItem && (
          <p className="mt-2 text-sm font-medium text-orange-300">
            {existingItem.quantity} currently in stock under <span className="font-mono">{existingItem.sku}</span> — this adds to that total.
          </p>
        )}

        <div className="mt-4 flex items-center gap-3">
          <button disabled={!canSubmit} onClick={submitAdd}
            className="rounded-lg bg-orange-500 px-5 py-2.5 text-sm font-bold text-black hover:bg-orange-400 disabled:opacity-40">
            {existingItem ? "Add to stock" : "Create item"}
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
                    <div className="grid gap-3 sm:grid-cols-5">
                      <input type="text" placeholder="Name" value={editFields.name ?? ""}
                        onChange={(e) => setEditFields({ ...editFields, name: e.target.value })}
                        className={INPUT_CLASS} />
                      <input type="text" placeholder="Subtitle" value={editFields.subtitle ?? ""}
                        onChange={(e) => setEditFields({ ...editFields, subtitle: e.target.value })}
                        className={INPUT_CLASS} />
                      <input type="number" min="0" placeholder="Qty" value={String(editFields.quantity ?? 0)}
                        onChange={(e) => setEditFields({ ...editFields, quantity: Number(e.target.value) })}
                        className={INPUT_CLASS} />
                      <input type="number" min="0" step="0.01" placeholder="Unit Price ($)"
                        value={String((editFields.priceCents ?? 0) / 100)}
                        onChange={(e) => setEditFields({ ...editFields, priceCents: Math.round(Number(e.target.value) * 100) })}
                        className={INPUT_CLASS} />
                      <input type="number" min="0" step="0.01" placeholder="Cost ($)"
                        value={String((editFields.costCents ?? 0) / 100)}
                        onChange={(e) => setEditFields({ ...editFields, costCents: Math.round(Number(e.target.value) * 100) })}
                        className={INPUT_CLASS} />
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
                          {editContent.trim().split("\n").filter((l) => l.trim()).length} line(s) — quantity will auto-sync on save
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
                      {it.subtitle && (
                        <div className="text-sm italic text-orange-300/70">{it.subtitle}</div>
                      )}
                      <div className="mt-1 flex flex-wrap gap-x-4 text-sm font-medium text-orange-300">
                        <span>SKU: <strong>{it.sku}</strong></span>
                        <span className={it.quantity <= 5 ? "font-bold text-amber-400" : ""}>Qty: <strong>{it.quantity}</strong></span>
                        <span>Price: <strong>{dollars(it.priceCents)}</strong> per unit</span>
                        <span>Cost: <strong>{dollars(it.costCents)}</strong> per unit</span>
                        <span className="font-bold text-emerald-400">Margin: {dollars(it.priceCents - it.costCents)}</span>
                        {it.content && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-blue-600/40 bg-blue-900/30 px-2 py-0.5 text-blue-300">
                            📦 {it.content.split("\n").filter((l) => l.trim()).length} lines
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
