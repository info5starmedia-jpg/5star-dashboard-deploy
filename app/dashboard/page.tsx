"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";

type Product = {
  id: string;
  name: string;
  sku: string;
  priceCents: number;
  quantity: number;
};

type OrderLineItem = {
  id: string;
  description: string;
  sku: string | null;
  quantity: number;
  unitPriceCents: number;
  totalCents: number;
};

type Order = {
  id: string;
  createdAt: string;
  totalCents: number;
  subtotalCents: number;
  taxCents: number;
  status: string;
  lineItems: OrderLineItem[];
};

const fmt = (cents: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);

function Spinner({ size = "sm" }: { size?: "sm" | "lg" }) {
  const cls =
    size === "lg"
      ? "h-6 w-6 border-2 border-zinc-200 border-t-zinc-700"
      : "h-4 w-4 border-2 border-zinc-300 border-t-zinc-700";
  return <span className={`inline-block animate-spin rounded-full ${cls}`} />;
}

// ── Buy Modal ──────────────────────────────────────────────────────────────────
function BuyModal({
  product,
  onClose,
  onSuccess,
}: {
  product: Product;
  onClose: () => void;
  onSuccess: (order: Order) => void;
}) {
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    // Close on Escape
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const totalCents = product.priceCents * qty;
  const maxQty = product.quantity;

  async function handleBuy() {
    if (qty < 1 || qty > maxQty) return;
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/user/purchase", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sku: product.sku, quantity: qty }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Purchase failed");
      onSuccess(data.order);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Purchase failed");
      setBusy(false);
    }
  }

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-bold text-zinc-900">Buy {product.name}</h2>
        <p className="mt-1 text-xs text-zinc-400 font-mono">{product.sku}</p>

        <div className="mt-5 space-y-4">
          {/* Quantity */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">
              Quantity{" "}
              <span className="text-zinc-400 font-normal">({maxQty} available)</span>
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 text-lg font-medium hover:bg-zinc-50 disabled:opacity-40"
                disabled={qty <= 1 || busy}
              >
                −
              </button>
              <input
                ref={inputRef}
                type="number"
                min={1}
                max={maxQty}
                value={qty}
                onChange={(e) => {
                  const v = Math.max(1, Math.min(maxQty, Math.floor(Number(e.target.value) || 1)));
                  setQty(v);
                }}
                className="w-20 rounded-lg border border-zinc-200 px-3 py-2 text-center text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-zinc-300"
                disabled={busy}
              />
              <button
                type="button"
                onClick={() => setQty((q) => Math.min(maxQty, q + 1))}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 text-lg font-medium hover:bg-zinc-50 disabled:opacity-40"
                disabled={qty >= maxQty || busy}
              >
                +
              </button>
            </div>
          </div>

          {/* Price breakdown */}
          <div className="rounded-xl border border-zinc-100 bg-zinc-50 px-4 py-3 text-sm space-y-1">
            <div className="flex justify-between text-zinc-500">
              <span>Unit price</span>
              <span>{fmt(product.priceCents)}</span>
            </div>
            <div className="flex justify-between text-zinc-500">
              <span>Quantity</span>
              <span>× {qty}</span>
            </div>
            <div className="flex justify-between font-bold text-zinc-900 pt-1 border-t border-zinc-200">
              <span>Total</span>
              <span>{fmt(totalCents)}</span>
            </div>
          </div>

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="flex-1 rounded-xl border border-zinc-200 py-2.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleBuy}
              disabled={busy || qty < 1 || qty > maxQty}
              className="flex-1 rounded-xl bg-zinc-900 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {busy ? <><Spinner /> Processing…</> : `Confirm — ${fmt(totalCents)}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Success Banner ─────────────────────────────────────────────────────────────
function SuccessBanner({ order, onDismiss }: { order: Order; onDismiss: () => void }) {
  const item = order.lineItems[0];
  useEffect(() => {
    const t = setTimeout(onDismiss, 6000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <div className="rounded-2xl border border-green-200 bg-green-50 px-5 py-4 shadow-sm flex items-start justify-between gap-4">
      <div>
        <p className="text-sm font-semibold text-green-900">
          ✅ Order confirmed — {fmt(order.totalCents)}
        </p>
        {item && (
          <p className="mt-0.5 text-xs text-green-700">
            {item.quantity}× {item.description} purchased. Check <strong>My Orders</strong> for your receipt.
          </p>
        )}
      </div>
      <button
        onClick={onDismiss}
        className="shrink-0 text-green-500 hover:text-green-700 text-lg leading-none"
      >
        ×
      </button>
    </div>
  );
}

// ── Product Card ───────────────────────────────────────────────────────────────
function ProductCard({
  product,
  onBuy,
}: {
  product: Product;
  onBuy: (p: Product) => void;
}) {
  const inStock = product.quantity > 0;
  const lowStock = product.quantity > 0 && product.quantity <= 5;

  return (
    <div className="flex flex-col rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-zinc-900 truncate">{product.name}</h3>
          <p className="mt-0.5 text-xs text-zinc-400 font-mono">{product.sku}</p>
        </div>
        <span
          className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${
            !inStock
              ? "bg-zinc-100 text-zinc-400 border-zinc-200"
              : lowStock
              ? "bg-amber-50 text-amber-700 border-amber-200"
              : "bg-green-50 text-green-700 border-green-200"
          }`}
        >
          {!inStock ? "Out of stock" : lowStock ? `Only ${product.quantity} left` : `${product.quantity} in stock`}
        </span>
      </div>

      <div className="mt-4 flex items-end justify-between gap-2">
        <p className="text-2xl font-bold text-zinc-900">{fmt(product.priceCents)}</p>
        <p className="text-xs text-zinc-400">per unit</p>
      </div>

      <button
        type="button"
        disabled={!inStock}
        onClick={() => onBuy(product)}
        className="mt-4 w-full rounded-xl bg-zinc-900 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {inStock ? "Buy" : "Out of Stock"}
      </button>
    </div>
  );
}

// ── Order Card ─────────────────────────────────────────────────────────────────
function OrderCard({ order }: { order: Order }) {
  const [open, setOpen] = useState(false);
  const shortId = order.id.slice(-8).toUpperCase();

  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
      <button
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-zinc-50 transition"
        onClick={() => setOpen((o) => !o)}
        type="button"
      >
        <div>
          <p className="font-mono text-sm font-semibold text-zinc-800">Order #{shortId}</p>
          <p className="text-xs text-zinc-400 mt-0.5">
            {new Date(order.createdAt).toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-lg font-bold text-zinc-900">{fmt(order.totalCents)}</span>
          <span className="text-zinc-400 text-sm">{open ? "▲" : "▼"}</span>
        </div>
      </button>

      {open && (
        <div className="border-t border-zinc-100 px-5 py-4 space-y-2">
          {order.lineItems.map((item) => (
            <div key={item.id} className="flex justify-between text-sm">
              <span className="text-zinc-700">
                {item.description}
                {item.sku && (
                  <span className="ml-1 text-zinc-400 font-mono text-xs">[{item.sku}]</span>
                )}
                <span className="ml-2 text-zinc-400">× {item.quantity}</span>
              </span>
              <span className="font-medium text-zinc-900">{fmt(item.totalCents)}</span>
            </div>
          ))}
          <div className="flex justify-between text-sm font-bold text-zinc-900 pt-2 border-t border-zinc-100">
            <span>Total</span>
            <span>{fmt(order.totalCents)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Dashboard ─────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { data: session, status } = useSession();
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [activeTab, setActiveTab] = useState<"products" | "orders">("products");
  const [buyTarget, setBuyTarget] = useState<Product | null>(null);
  const [successOrder, setSuccessOrder] = useState<Order | null>(null);

  const loadProducts = useCallback(() => {
    setLoadingProducts(true);
    fetch("/api/user/products")
      .then((r) => r.json())
      .then((d) => setProducts(d.products ?? []))
      .finally(() => setLoadingProducts(false));
  }, []);

  const loadOrders = useCallback(() => {
    setLoadingOrders(true);
    fetch("/api/user/orders")
      .then((r) => r.json())
      .then((d) => setOrders(d.orders ?? []))
      .finally(() => setLoadingOrders(false));
  }, []);

  useEffect(() => {
    if (status === "unauthenticated") { window.location.href = "/signin"; return; }
    if (status !== "authenticated") return;
    loadProducts();
    loadOrders();
  }, [status, loadProducts, loadOrders]);

  function handlePurchaseSuccess(order: Order) {
    setBuyTarget(null);
    setSuccessOrder(order);
    // Refresh both — stock changed + new order
    loadProducts();
    setOrders((prev) => [order, ...prev]);
    // Switch to orders tab so customer sees their receipt
    setActiveTab("orders");
  }

  if (status === "loading") {
    return (
      <div className="flex h-64 items-center justify-center gap-2 text-sm text-zinc-500">
        <Spinner size="lg" /> Loading…
      </div>
    );
  }

  if (!session) return null;

  const email = session.user?.email ?? "";
  const role = (session.user as { role?: string })?.role ?? "user";
  const totalSpent = orders.reduce((s, o) => s + o.totalCents, 0);
  const totalItems = orders.reduce(
    (s, o) => s + o.lineItems.reduce((ls, li) => ls + li.quantity, 0),
    0
  );

  return (
    <>
      {/* Buy modal */}
      {buyTarget && (
        <BuyModal
          product={buyTarget}
          onClose={() => setBuyTarget(null)}
          onSuccess={handlePurchaseSuccess}
        />
      )}

      <div className="mx-auto w-full max-w-5xl px-6 py-10 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Dashboard</p>
            <h1 className="text-3xl font-bold text-zinc-900">Welcome back</h1>
            <p className="mt-1 text-sm text-zinc-500">
              {email}
              {role === "admin" && (
                <span className="ml-2 inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
                  admin
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Success banner */}
        {successOrder && (
          <SuccessBanner order={successOrder} onDismiss={() => setSuccessOrder(null)} />
        )}

        {/* Summary cards */}
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { label: "Total Orders", value: orders.length },
            { label: "Total Spent", value: fmt(totalSpent) },
            { label: "Items Purchased", value: totalItems },
          ].map((c) => (
            <div
              key={c.label}
              className="rounded-xl border border-zinc-200 bg-white px-5 py-4 shadow-sm"
            >
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{c.label}</p>
              <p className="mt-1 text-3xl font-bold text-zinc-900">{c.value}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="border-b border-zinc-200">
          <div className="flex gap-0">
            {(["products", "orders"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-5 py-3 text-sm font-medium border-b-2 transition ${
                  activeTab === tab
                    ? "border-zinc-900 text-zinc-900"
                    : "border-transparent text-zinc-500 hover:text-zinc-700"
                }`}
              >
                {tab === "products"
                  ? `Products${products.length > 0 ? ` (${products.length})` : ""}`
                  : `My Orders${orders.length > 0 ? ` (${orders.length})` : ""}`}
              </button>
            ))}
          </div>
        </div>

        {/* Products tab */}
        {activeTab === "products" && (
          <div>
            {loadingProducts ? (
              <div className="flex items-center gap-2 py-8 text-sm text-zinc-500">
                <Spinner /> Loading products…
              </div>
            ) : products.length === 0 ? (
              <div className="rounded-2xl border border-zinc-200 bg-white px-6 py-12 text-center shadow-sm">
                <p className="text-zinc-400 text-sm">No products available right now.</p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {products.map((p) => (
                  <ProductCard key={p.id} product={p} onBuy={setBuyTarget} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Orders tab */}
        {activeTab === "orders" && (
          <div>
            {loadingOrders ? (
              <div className="flex items-center gap-2 py-8 text-sm text-zinc-500">
                <Spinner /> Loading orders…
              </div>
            ) : orders.length === 0 ? (
              <div className="rounded-2xl border border-zinc-200 bg-white px-6 py-12 text-center shadow-sm">
                <p className="text-zinc-400 text-sm">No orders yet.</p>
                <button
                  onClick={() => setActiveTab("products")}
                  className="mt-3 text-sm font-medium text-zinc-700 underline"
                >
                  Browse products
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {orders.map((o) => (
                  <OrderCard key={o.id} order={o} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
