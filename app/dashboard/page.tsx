"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";

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

function Spinner() {
  return (
    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-700" />
  );
}

function ProductCard({ product }: { product: Product }) {
  const inStock = product.quantity > 0;
  return (
    <div className="flex flex-col rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold text-zinc-900">{product.name}</h3>
          <p className="mt-0.5 text-xs text-zinc-400 font-mono">{product.sku}</p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
            inStock
              ? "bg-green-50 text-green-700 border border-green-200"
              : "bg-zinc-100 text-zinc-400 border border-zinc-200"
          }`}
        >
          {inStock ? `${product.quantity} in stock` : "Out of stock"}
        </span>
      </div>
      <div className="mt-4 flex items-end justify-between gap-2">
        <p className="text-2xl font-bold text-zinc-900">{fmt(product.priceCents)}</p>
        <p className="text-xs text-zinc-400">per unit</p>
      </div>
    </div>
  );
}

function OrderCard({ order }: { order: Order }) {
  const [open, setOpen] = useState(false);
  const shortId = order.id.slice(-8).toUpperCase();
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
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
                {item.sku && <span className="ml-1 text-zinc-400 font-mono text-xs">[{item.sku}]</span>}
                <span className="ml-2 text-zinc-400">× {item.quantity}</span>
              </span>
              <span className="font-medium text-zinc-900">{fmt(item.totalCents)}</span>
            </div>
          ))}
          {order.taxCents > 0 && (
            <div className="flex justify-between text-sm text-zinc-500 pt-2 border-t border-zinc-100">
              <span>Tax</span>
              <span>{fmt(order.taxCents)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm font-bold text-zinc-900 pt-1">
            <span>Total</span>
            <span>{fmt(order.totalCents)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [activeTab, setActiveTab] = useState<"products" | "orders">("products");

  useEffect(() => {
    if (status === "unauthenticated") {
      window.location.href = "/signin";
      return;
    }
    if (status !== "authenticated") return;

    fetch("/api/user/products")
      .then((r) => r.json())
      .then((d) => setProducts(d.products ?? []))
      .finally(() => setLoadingProducts(false));

    fetch("/api/user/orders")
      .then((r) => r.json())
      .then((d) => setOrders(d.orders ?? []))
      .finally(() => setLoadingOrders(false));
  }, [status]);

  if (status === "loading") {
    return (
      <div className="flex h-64 items-center justify-center gap-2 text-sm text-zinc-500">
        <Spinner /> Loading…
      </div>
    );
  }

  if (!session) return null;

  const email = session.user?.email ?? "";
  const role = (session.user as { role?: string })?.role ?? "user";

  const totalSpent = orders.reduce((s, o) => s + o.totalCents, 0);
  const totalItems = orders.reduce((s, o) => s + o.lineItems.reduce((ls, li) => ls + li.quantity, 0), 0);

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-10 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Dashboard</p>
          <h1 className="text-3xl font-bold text-zinc-900">Welcome back</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Signed in as <span className="font-medium text-zinc-800">{email}</span>
            {role === "admin" && (
              <span className="ml-2 inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
                admin
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-zinc-200 bg-white px-5 py-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Total Orders</p>
          <p className="mt-1 text-3xl font-bold text-zinc-900">{orders.length}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white px-5 py-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Total Spent</p>
          <p className="mt-1 text-3xl font-bold text-zinc-900">{fmt(totalSpent)}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white px-5 py-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Items Purchased</p>
          <p className="mt-1 text-3xl font-bold text-zinc-900">{totalItems}</p>
        </div>
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
              {tab === "products" ? "Products" : `My Orders${orders.length > 0 ? ` (${orders.length})` : ""}`}
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
                <ProductCard key={p.id} product={p} />
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
  );
}
