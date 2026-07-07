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
  const [priceCents, setPriceCents] = useState("0");
  const [costCents, setCostCents] = useState("0");

  const category = getInventoryCategory(categoryKey);
  const existingItem = useMemo(
    () => (category.sku ? items.find((i) => i.sku === category.sku) ?? null : null),
    [items, category.sku]
  );

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFields, setEditFields] = useState<Partial<Item>>({});

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
      setPriceCents("0");
      setCostCents("0");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryKey]);

  useEffect(() => {
    if (!category.sku) return;
    const match = items.find((i) => i.sku === category.sku) ?? null;
    setName(match ? match.name : category.defaultName);
    setSku(category.sku);
    setSubtitle(match?.subtitle ?? "");
    setPriceCents(match ? String(match.priceCents) : "0");
    setCostCents(match ? String(match.costCents) : "0");
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

  const canSubmit = useMemo(() => {
    return (
      name.trim() &&
      sku.trim() &&
      Number.isFinite(Number(quantity)) && Number(quantity) >= 0 &&
      Number.isFinite(Number(priceCents)) && Number(priceCents) >= 0 &&
      Number.isFinite(Number(costCents)) && Number(costCents) >= 0
    );
  }, [name, sku, quantity, priceCents, costCents]);

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
      if (existingItem) {
        // Restock: reuse the pooled SKU, add to its existing quantity instead
        // of creating a duplicate row.
        await api(`/api/admin/inventory/${existingItem.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            subtitle: category.hasSubtitle ? subtitle.trim() : undefined,
            quantity: existingItem.quantity + Math.floor(Number(quantity)),
            priceCents: Number(priceCents),
            costCents: Number(costCents),
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
            quantity: Number(quantity),
            priceCents: Number(priceCents),
            costCents: Number(costCents),
          }),
        });
      }
      setQuantity("1");
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
  }

  async function saveEdit(id: string) {
    setErr(null);
    try {
      await api(`/api/admin/inventory/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editFields),
      });
      setEditingId(null);
      setEditFields({});
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
      <div className="admin-card rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-base font-semibold text-zinc-900">Inventory Metrics</h3>
        {metrics ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-4">
            {[
              { label: "Total Units", value: metrics.totalUnits.toLocaleString(), accent: false },
              { label: "Inventory Value", value: dollars(metrics.totalValueCents), accent: false },
              { label: "Total Cost", value: dollars(metrics.totalCostCents), accent: false },
              { label: "Est. Profit", value: dollars(metrics.profitCents), accent: true },
            ].map((m) => (
              <div key={m.label} className={`rounded-xl p-4 ${m.accent ? "bg-emerald-50" : "bg-zinc-50"}`}>
                <div className={`text-xs font-medium uppercase tracking-wide ${m.accent ? "text-emerald-600" : "text-zinc-500"}`}>{m.label}</div>
                <div className={`mt-1 text-2xl font-bold ${m.accent ? "text-emerald-700" : "text-zinc-900"}`}>{m.value}</div>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-zinc-400">No metrics yet.</p>
        )}
      </div>

      {/* Add Item */}
      <div className="admin-card rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-base font-semibold text-zinc-900">Add Item</h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-6">
          <select
            value={categoryKey}
            onChange={(e) => setCategoryKey(e.target.value)}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400"
          >
            {INVENTORY_CATEGORIES.map((c) => (
              <option key={c.key} value={c.key}>{c.label}</option>
            ))}
          </select>

          <input placeholder="Name" value={name} onChange={(e) => handleNameChange(e.target.value)}
            className="rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400" />

          <input placeholder="SKU" value={sku} disabled={category.sku !== null}
            onChange={(e) => handleSkuChange(e.target.value)}
            className="rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400 disabled:bg-zinc-100 disabled:text-zinc-400" />

          {category.hasSubtitle && (
            <input placeholder="Subtitle" value={subtitle} onChange={(e) => setSubtitle(e.target.value)}
              className="rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400" />
          )}

          {[
            { placeholder: "Qty to add", value: quantity, onChange: setQuantity },
            { placeholder: "Price (cents)", value: priceCents, onChange: setPriceCents },
            { placeholder: "Cost (cents)", value: costCents, onChange: setCostCents },
          ].map((f) => (
            <input key={f.placeholder} type="number" min="0" placeholder={f.placeholder} value={f.value}
              onChange={(e) => f.onChange(e.target.value)}
              className="rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400" />
          ))}
        </div>

        {existingItem && (
          <p className="mt-2 text-xs text-zinc-500">
            {existingItem.quantity} currently in stock under <span className="font-mono">{existingItem.sku}</span> — this adds to that total.
          </p>
        )}

        <div className="mt-4 flex items-center gap-3">
          <button disabled={!canSubmit} onClick={submitAdd}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-40">
            {existingItem ? "Add to stock" : "Create item"}
          </button>
          <button onClick={refresh}
            className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50">
            Refresh
          </button>
          {loading && (
            <div className="flex items-center gap-2 text-sm text-zinc-400">
              <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-zinc-200 border-t-zinc-500" />
              Loading...
            </div>
          )}
        </div>
        {err && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{err}</div>
        )}
      </div>

      {/* Items List */}
      <div className="admin-card rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-base font-semibold text-zinc-900">
          Items {items.length > 0 && <span className="font-normal text-zinc-400">({items.length})</span>}
        </h3>
        {items.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-400">No items yet.</p>
        ) : (
          <div className="mt-4 grid gap-3">
            {items.map((it) => (
              <div key={it.id} className="rounded-xl border border-zinc-100 bg-zinc-50/50 p-4 transition hover:border-zinc-200">
                {editingId === it.id ? (
                  <div className="grid gap-3">
                    <div className="grid gap-3 sm:grid-cols-5">
                      {[
                        { placeholder: "Name", value: editFields.name ?? "", key: "name" as keyof Item },
                        { placeholder: "Subtitle", value: editFields.subtitle ?? "", key: "subtitle" as keyof Item },
                        { placeholder: "Qty", value: String(editFields.quantity ?? 0), key: "quantity" as keyof Item },
                        { placeholder: "Price (cents)", value: String(editFields.priceCents ?? 0), key: "priceCents" as keyof Item },
                        { placeholder: "Cost (cents)", value: String(editFields.costCents ?? 0), key: "costCents" as keyof Item },
                      ].map((f) => {
                        const isText = f.key === "name" || f.key === "subtitle";
                        return (
                          <input key={f.key} type={isText ? "text" : "number"} min="0"
                            placeholder={f.placeholder} value={f.value as string}
                            onChange={(e) => setEditFields({ ...editFields, [f.key]: isText ? e.target.value : Number(e.target.value) })}
                            className="rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-400" />
                        );
                      })}
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => saveEdit(it.id)}
                        className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800">
                        Save
                      </button>
                      <button onClick={() => { setEditingId(null); setEditFields({}); }}
                        className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-600 hover:bg-zinc-50">
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="font-medium text-zinc-900">{it.name}</div>
                      {it.subtitle && (
                        <div className="text-xs italic text-zinc-400">{it.subtitle}</div>
                      )}
                      <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-zinc-500">
                        <span>SKU: {it.sku}</span>
                        <span className={it.quantity <= 5 ? "font-medium text-amber-600" : ""}>Qty: {it.quantity}</span>
                        <span>Price: {dollars(it.priceCents)}</span>
                        <span>Cost: {dollars(it.costCents)}</span>
                        <span className="text-emerald-600">Margin: {dollars(it.priceCents - it.costCents)}</span>
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <button onClick={() => startEdit(it)}
                        className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100">
                        Edit
                      </button>
                      <button onClick={() => del(it.id)}
                        className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50">
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
