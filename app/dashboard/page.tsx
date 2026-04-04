"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";

// ── Types ──────────────────────────────────────────────────────────────────────
type PlanCard = {
  slug: string;
  name: string;
  description: string;
  priceCents: number;
  packSize: number | null;
  badge: string | null;
  features: string[];
  available: boolean;
  poolQuantity: number | null;
};

type OrderLineItem = {
  id: string;
  description: string;
  sku: string | null;
  quantity: number;
  unitPriceCents: number;
  totalCents: number;
  deliveredContent: string | null;
};

type Order = {
  id: string;
  createdAt: string;
  totalCents: number;
  status: string;
  lineItems: OrderLineItem[];
};

const fmt = (cents: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);

// ── Spinner ────────────────────────────────────────────────────────────────────
function Spinner({ size = "sm" }: { size?: "sm" | "lg" }) {
  const cls =
    size === "lg"
      ? "h-6 w-6 border-2 border-orange-400/30 border-t-orange-400"
      : "h-4 w-4 border-2 border-orange-400/30 border-t-orange-400";
  return <span className={`inline-block animate-spin rounded-full ${cls}`} />;
}

// ── Server Plan Card ───────────────────────────────────────────────────────────
function ServerPlanCard({
  plan,
  onSubscribe,
  busy,
}: {
  plan: PlanCard;
  onSubscribe: (slug: string) => void;
  busy: string | null;
}) {
  const isBusy = busy === plan.slug;

  return (
    <div
      className={`relative flex flex-col rounded-2xl border p-6 shadow-sm transition ${
        plan.available
          ? "border-orange-400/50 bg-zinc-900 hover:border-orange-400"
          : "border-zinc-700 bg-zinc-900/50 opacity-60"
      }`}
    >
      {plan.badge && plan.available && (
        <span className="absolute -top-3 left-5 rounded-full bg-orange-500 px-3 py-0.5 text-xs font-bold text-black">
          {plan.badge}
        </span>
      )}
      <div className="mb-4">
        <p className="text-xs font-bold uppercase tracking-widest text-orange-400">Server</p>
        <h3 className="mt-1 text-lg font-extrabold text-orange-400">{plan.name}</h3>
        <p className="mt-1 text-sm font-semibold text-orange-300">{plan.description}</p>
      </div>
      <div className="mb-4">
        <span className="text-3xl font-extrabold text-orange-400">{fmt(plan.priceCents)}</span>
        <span className="ml-1 text-sm font-semibold text-orange-300">/month</span>
      </div>
      <ul className="mb-6 space-y-1.5 text-sm font-semibold text-orange-300">
        {plan.features.map((feat, i) => (
          <li key={i}>✅ {feat}</li>
        ))}
      </ul>
      <button
        onClick={() => plan.available && onSubscribe(plan.slug)}
        disabled={!plan.available || busy !== null}
        className={`mt-auto w-full rounded-xl py-3 text-sm font-bold transition ${
          plan.available
            ? "bg-orange-500 text-black hover:bg-orange-400 disabled:opacity-60"
            : "cursor-not-allowed bg-zinc-700 text-zinc-500"
        }`}
      >
        {isBusy ? (
          <span className="flex items-center justify-center gap-2">
            <Spinner /> Redirecting…
          </span>
        ) : plan.available ? (
          `Subscribe — ${fmt(plan.priceCents)}/mo`
        ) : (
          "Out of Stock"
        )}
      </button>
    </div>
  );
}

// ── ISP Proxy Card (single card with quantity dropdown) ────────────────────────
const ISP_QUANTITIES = [10, 25, 50, 75] as const;
type IspQty = (typeof ISP_QUANTITIES)[number];

function ISPProxyCard({
  ispPlans,
  onSubscribe,
  busy,
}: {
  ispPlans: PlanCard[];
  onSubscribe: (slug: string) => void;
  busy: string | null;
}) {
  const [selectedQty, setSelectedQty] = useState<IspQty>(10);

  const selectedPlan = useMemo(
    () => ispPlans.find((p) => p.packSize === selectedQty) ?? null,
    [ispPlans, selectedQty]
  );

  const isAvailable = selectedPlan?.available ?? false;
  const isBusy = busy === selectedPlan?.slug;

  return (
    <div className="relative flex flex-col rounded-2xl border border-orange-400/50 bg-zinc-900 p-6 shadow-sm transition hover:border-orange-400">
      {/* Header */}
      <div className="mb-4">
        <p className="text-xs font-bold uppercase tracking-widest text-orange-400">ISP Proxies</p>
        <h3 className="mt-1 text-lg font-extrabold text-orange-400">Viking USA ISP</h3>
        <p className="mt-1 text-sm font-semibold text-orange-300">
          Premium USA ISP proxies — yours for the life of your subscription.
        </p>
      </div>

      {/* Quantity dropdown */}
      <div className="mb-4">
        <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-orange-400">
          Quantity
        </label>
        <select
          value={selectedQty}
          onChange={(e) => setSelectedQty(Number(e.target.value) as IspQty)}
          className="w-full rounded-lg border border-orange-400/40 bg-zinc-800 px-3 py-2.5 text-sm font-semibold text-orange-300 focus:border-orange-400 focus:outline-none"
        >
          {ISP_QUANTITIES.map((qty) => {
            const plan = ispPlans.find((p) => p.packSize === qty);
            return (
              <option key={qty} value={qty}>
                {qty} Proxies{plan ? ` — ${fmt(plan.priceCents)}/mo` : ""}
              </option>
            );
          })}
        </select>
      </div>

      {/* Price */}
      {selectedPlan && (
        <div className="mb-4">
          <span className="text-3xl font-extrabold text-orange-400">
            {fmt(selectedPlan.priceCents)}
          </span>
          <span className="ml-1 text-sm font-semibold text-orange-300">/month</span>
        </div>
      )}

      {/* Features */}
      <ul className="mb-6 space-y-1.5 text-sm font-semibold text-orange-300">
        <li>✅ {selectedQty} dedicated USA ISP proxies</li>
        <li>✅ Yours for the life of subscription</li>
        <li>✅ High-speed residential IPs</li>
        <li>✅ Cancel anytime</li>
      </ul>

      {/* Stock indicator */}
      <div className="mb-4 rounded-lg border border-orange-400/20 bg-zinc-800 px-3 py-2">
        {isAvailable ? (
          <p className="text-xs font-bold text-emerald-400">✅ In stock — fulfillment ready</p>
        ) : (
          <p className="text-xs font-bold text-red-400">❌ Currently out of stock</p>
        )}
      </div>

      {/* Subscribe button */}
      <button
        onClick={() => selectedPlan && isAvailable && onSubscribe(selectedPlan.slug)}
        disabled={!isAvailable || !selectedPlan || busy !== null}
        className={`mt-auto w-full rounded-xl py-3 text-sm font-bold transition ${
          isAvailable && selectedPlan
            ? "bg-orange-500 text-black hover:bg-orange-400 disabled:opacity-60"
            : "cursor-not-allowed bg-zinc-700 text-zinc-500"
        }`}
      >
        {isBusy ? (
          <span className="flex items-center justify-center gap-2">
            <Spinner /> Redirecting…
          </span>
        ) : isAvailable && selectedPlan ? (
          `Subscribe — ${fmt(selectedPlan.priceCents)}/mo`
        ) : (
          "Out of Stock"
        )}
      </button>
    </div>
  );
}

// ── Purchase Result Banner ─────────────────────────────────────────────────────
function PurchaseBanner({ type, onDismiss }: { type: "success" | "cancelled"; onDismiss: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 8000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  if (type === "cancelled") {
    return (
      <div className="flex items-center justify-between gap-4 rounded-2xl border border-orange-400/30 bg-zinc-900 px-5 py-4 shadow-sm">
        <p className="text-sm font-semibold text-orange-300">Checkout was cancelled — no charge made.</p>
        <button onClick={onDismiss} className="text-xl font-bold text-orange-400 hover:text-orange-300">×</button>
      </div>
    );
  }

  return (
    <div className="flex items-start justify-between gap-4 rounded-2xl border border-emerald-500/40 bg-emerald-900/30 px-5 py-4 shadow-sm">
      <div>
        <p className="text-sm font-bold text-emerald-400">✅ Subscription confirmed — thank you!</p>
        <p className="mt-0.5 text-xs font-semibold text-emerald-300">
          Your ISP lines will appear in <strong>My Orders</strong> shortly.
        </p>
      </div>
      <button onClick={onDismiss} className="shrink-0 text-xl font-bold text-emerald-400 hover:text-emerald-300">×</button>
    </div>
  );
}

// ── Order Card ─────────────────────────────────────────────────────────────────
function OrderCard({ order }: { order: Order }) {
  const [open, setOpen] = useState(false);
  const shortId = order.id.slice(-8).toUpperCase();

  return (
    <div className="overflow-hidden rounded-2xl border border-orange-400/30 bg-zinc-900 shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-5 py-4 text-left transition hover:bg-zinc-800"
      >
        <div>
          <p className="font-mono text-sm font-bold text-orange-400">Order #{shortId}</p>
          <p className="mt-0.5 text-xs font-semibold text-orange-300">
            {new Date(order.createdAt).toLocaleDateString("en-US", {
              month: "long", day: "numeric", year: "numeric",
            })}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-lg font-extrabold text-orange-400">{fmt(order.totalCents)}</span>
          <span className="text-sm font-bold text-orange-300">{open ? "▲" : "▼"}</span>
        </div>
      </button>

      {open && (
        <div className="space-y-3 border-t border-orange-400/20 px-5 py-4">
          {order.lineItems.map((item) => (
            <div key={item.id}>
              <div className="flex justify-between text-sm">
                <span className="font-semibold text-orange-300">
                  {item.description}
                  <span className="ml-2 text-orange-300/60">× {item.quantity}</span>
                </span>
                <span className="font-bold text-orange-400">{fmt(item.totalCents)}</span>
              </div>
              {item.deliveredContent && (
                <div className="mt-2 rounded-lg border border-blue-500/40 bg-blue-900/30 p-3">
                  <p className="mb-1.5 text-xs font-bold text-blue-400">Your ISP lines</p>
                  <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-all font-mono text-xs text-blue-300">
                    {item.deliveredContent}
                  </pre>
                </div>
              )}
            </div>
          ))}
          <div className="flex justify-between border-t border-orange-400/20 pt-2 text-sm font-extrabold text-orange-400">
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
  const searchParams = useSearchParams();
  const purchaseResult = searchParams.get("checkout") as "success" | "cancelled" | null;

  const [plans, setPlans] = useState<PlanCard[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [activeTab, setActiveTab] = useState<"products" | "orders">(
    purchaseResult === "success" ? "orders" : "products"
  );
  const [subscribeBusy, setSubscribeBusy] = useState<string | null>(null);
  const [subscribeError, setSubscribeError] = useState<string | null>(null);
  const [banner, setBanner] = useState<"success" | "cancelled" | null>(purchaseResult);

  // Clean query params from URL
  useEffect(() => {
    if (purchaseResult) {
      const url = new URL(window.location.href);
      url.searchParams.delete("checkout");
      url.searchParams.delete("session_id");
      window.history.replaceState({}, "", url.toString());
    }
  }, [purchaseResult]);

  const loadPlans = useCallback(() => {
    setLoadingPlans(true);
    fetch("/api/user/products")
      .then((r) => r.json())
      .then((d) => setPlans(d.plans ?? []))
      .catch(() => setPlans([]))
      .finally(() => setLoadingPlans(false));
  }, []);

  const loadOrders = useCallback(() => {
    setLoadingOrders(true);
    fetch("/api/user/orders")
      .then((r) => r.json())
      .then((d) => setOrders(d.orders ?? []))
      .catch(() => setOrders([]))
      .finally(() => setLoadingOrders(false));
  }, []);

  useEffect(() => {
    if (status === "unauthenticated") { window.location.href = "/signin"; return; }
    if (status !== "authenticated") return;
    loadPlans();
    loadOrders();
    if (purchaseResult === "success") {
      const t1 = setTimeout(loadOrders, 3000);
      const t2 = setTimeout(loadOrders, 7000);
      return () => { clearTimeout(t1); clearTimeout(t2); };
    }
  }, [status, loadPlans, loadOrders, purchaseResult]);

  async function handleSubscribe(planSlug: string) {
    setSubscribeError(null);
    setSubscribeBusy(planSlug);
    try {
      const res = await fetch("/api/stripe/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planSlug }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `Error ${res.status}`);
      if (!data.url) throw new Error("No checkout URL returned");
      window.location.href = data.url;
    } catch (err) {
      setSubscribeError(err instanceof Error ? err.message : "Checkout failed");
      setSubscribeBusy(null);
    }
  }

  if (status === "loading") {
    return (
      <div className="flex h-64 items-center justify-center gap-2 text-sm font-bold text-orange-400">
        <Spinner size="lg" /> Loading…
      </div>
    );
  }

  if (!session) return null;

  const email = session.user?.email ?? "";
  const role = (session.user as { role?: string })?.role ?? "user";
  const totalItems = orders.reduce(
    (s, o) => s + o.lineItems.reduce((ls, li) => ls + li.quantity, 0),
    0
  );

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-6 py-10">

      {/* Header */}
      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-orange-400">Dashboard</p>
        <h1 className="text-3xl font-extrabold text-orange-400">Welcome back</h1>
        <p className="mt-1 text-sm font-bold text-orange-300">
          {email}
          {role === "admin" && (
            <span className="ml-2 inline-flex items-center rounded-full bg-orange-500/20 px-2 py-0.5 text-xs font-bold text-orange-400">
              admin
            </span>
          )}
        </p>
      </div>

      {/* Purchase result banner */}
      {banner && <PurchaseBanner type={banner} onDismiss={() => setBanner(null)} />}

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        {[
          { label: "Total Orders", value: orders.length },
          { label: "Items Purchased", value: totalItems },
        ].map((c) => (
          <div key={c.label} className="rounded-xl border border-orange-400/30 bg-zinc-900 px-5 py-4 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wide text-orange-400">{c.label}</p>
            <p className="mt-1 text-3xl font-extrabold text-orange-400">{c.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="border-b border-orange-400/30">
        <div className="flex">
          {(["products", "orders"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`border-b-2 px-5 py-3 text-sm font-bold transition ${
                activeTab === tab
                  ? "border-orange-400 text-orange-400"
                  : "border-transparent text-orange-300/60 hover:text-orange-400"
              }`}
            >
              {tab === "products"
                ? "Products"
                : `My Orders${orders.length > 0 ? ` (${orders.length})` : ""}`}
            </button>
          ))}
        </div>
      </div>

      {/* Products tab */}
      {activeTab === "products" && (
        <>
          {loadingPlans ? (
            <div className="flex items-center gap-2 py-8 text-sm font-semibold text-orange-400">
              <Spinner /> Loading products…
            </div>
          ) : (
            <>
              {subscribeError && (
                <div className="rounded-xl border border-red-500/40 bg-red-900/30 px-4 py-3 text-sm font-semibold text-red-400">
                  {subscribeError}
                </div>
              )}
              <div className="grid gap-5 sm:grid-cols-2">
                {/* Server plan(s) */}
                {plans
                  .filter((p) => p.packSize === null)
                  .map((plan) => (
                    <ServerPlanCard
                      key={plan.slug}
                      plan={plan}
                      onSubscribe={handleSubscribe}
                      busy={subscribeBusy}
                    />
                  ))}
                {/* ISP proxies — single card with quantity dropdown */}
                {plans.some((p) => p.packSize !== null) && (
                  <ISPProxyCard
                    ispPlans={plans.filter((p) => p.packSize !== null)}
                    onSubscribe={handleSubscribe}
                    busy={subscribeBusy}
                  />
                )}
              </div>
              <p className="mt-2 text-xs font-semibold text-orange-300/60">
                All plans are monthly recurring subscriptions. Cancel anytime from your{" "}
                <a href="/billing" className="underline text-orange-400">Billing page</a>.
              </p>
            </>
          )}
        </>
      )}

      {/* Orders tab */}
      {activeTab === "orders" && (
        <>
          {loadingOrders ? (
            <div className="flex items-center gap-2 py-8 text-sm font-semibold text-orange-400">
              <Spinner /> Loading orders…
            </div>
          ) : orders.length === 0 ? (
            <div className="rounded-2xl border border-orange-400/30 bg-zinc-900 px-6 py-12 text-center shadow-sm">
              <p className="text-sm font-semibold text-orange-300">
                {purchaseResult === "success"
                  ? "Your order is being processed — check back in a moment."
                  : "No orders yet."}
              </p>
              <button
                onClick={() => setActiveTab("products")}
                className="mt-3 text-sm font-bold text-orange-400 underline"
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
        </>
      )}
    </div>
  );
}
