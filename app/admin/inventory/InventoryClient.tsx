"use client";

import { useEffect, useMemo, useState } from "react";

type Item = {
  id: string;
  name: string;
  sku: string;
  quantity: number;
  priceCents: number;
};

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
  return data as T;
}

export default function InventoryClient() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [priceCents, setPriceCents] = useState("0");

  const canSubmit = useMemo(() => {
    return name.trim() && sku.trim() && Number.isFinite(Number(quantity)) && Number.isFinite(Number(priceCents));
  }, [name, sku, quantity, priceCents]);

  async function refresh() {
    setErr(null);
    setLoading(true);
    try {
      const data = await api<{ items: Item[] }>("/api/admin/inventory");
      setItems(data.items || []);
    } catch (e: any) {
      setErr(e?.message || "Failed to load inventory");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function createItem() {
    setErr(null);
    try {
      await api("/api/admin/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          sku: sku.trim(),
          quantity: Number(quantity),
          priceCents: Number(priceCents),
        }),
      });
      setName("");
      setSku("");
      setQuantity("1");
      setPriceCents("0");
      await refresh();
    } catch (e: any) {
      setErr(e?.message || "Create failed");
    }
  }

  async function del(id: string) {
    setErr(null);
    try {
      await api(`/api/admin/inventory/${id}`, { method: "DELETE" });
      await refresh();
    } catch (e: any) {
      setErr(e?.message || "Delete failed");
    }
  }

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ padding: 14, border: "1px solid #ddd", borderRadius: 12 }}>
        <div style={{ fontWeight: 700, marginBottom: 10 }}>Add item</div>

        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}>
          <input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} style={{ padding: 10, borderRadius: 10, border: "1px solid #ccc" }} />
          <input placeholder="SKU" value={sku} onChange={(e) => setSku(e.target.value)} style={{ padding: 10, borderRadius: 10, border: "1px solid #ccc" }} />
          <input placeholder="Qty" value={quantity} onChange={(e) => setQuantity(e.target.value)} style={{ padding: 10, borderRadius: 10, border: "1px solid #ccc" }} />
          <input placeholder="Price (cents)" value={priceCents} onChange={(e) => setPriceCents(e.target.value)} style={{ padding: 10, borderRadius: 10, border: "1px solid #ccc" }} />
        </div>

        <div style={{ marginTop: 10, display: "flex", gap: 10, alignItems: "center" }}>
          <button
            disabled={!canSubmit}
            onClick={createItem}
            style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid #333", cursor: "pointer" }}
          >
            Add stock
          </button>

          <button
            onClick={refresh}
            style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid #ccc", cursor: "pointer" }}
          >
            Refresh
          </button>

          {loading ? <span style={{ opacity: 0.7 }}>Loading…</span> : null}
        </div>

        {err ? <div style={{ marginTop: 10, color: "#b00020" }}>{err}</div> : null}
      </div>

      <div style={{ padding: 14, border: "1px solid #ddd", borderRadius: 12 }}>
        <div style={{ fontWeight: 700, marginBottom: 10 }}>Items</div>

        {items.length === 0 ? (
          <div style={{ opacity: 0.8 }}>No items yet.</div>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {items.map((it) => (
              <div key={it.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, border: "1px solid #eee", borderRadius: 10, padding: 10 }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{it.name}</div>
                  <div style={{ opacity: 0.8, fontSize: 13 }}>
                    SKU: {it.sku} · Qty: {it.quantity} · Price: {it.priceCents}¢
                  </div>
                </div>
                <button onClick={() => del(it.id)} style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #ccc", cursor: "pointer" }}>
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
