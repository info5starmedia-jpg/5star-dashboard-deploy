"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { ISP_POOL_SKU } from "@/lib/constants";

// ── Types ──────────────────────────────────────────────────────────────────────
type PlanCard = {
  slug: string;
  name: string;
  description: string;
  priceCents: number;
  packSize: number;
  inventorySku: string;
  badge: string | null;
  features: string[];
  available: boolean;
  poolQuantity: number;
  oneTime: boolean;
};

type SubData = {
  status: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  priceId: string;
} | null;

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
  cents === 0
    ? "—"
    : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);

// ── Spinner ────────────────────────────────────────────────────────────────────
function Spinner({ size = "sm" }: { size?: "sm" | "lg" }) {
  const cls =
    size === "lg"
      ? "h-6 w-6 border-2 border-orange-400/30 border-t-orange-400"
      : "h-4 w-4 border-2 border-orange-400/30 border-t-orange-400";
  return <span className={`inline-block animate-spin rounded-full ${cls}`} />;
}

// ── Gold Checkmark ─────────────────────────────────────────────────────────────
function GoldCheck() {
  return (
    <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-yellow-400">
      <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="none">
        <path d="M2 6l3 3 5-5" stroke="#000" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

// ── Stock Badge ────────────────────────────────────────────────────────────────
function StockBadge({ qty, packSize }: { qty: number; packSize: number }) {
  const inStock = qty >= packSize;
  return (
    <div className="mb-4 rounded-lg border border-orange-400/20 bg-zinc-800 px-3 py-2">
      {inStock ? (
        <p className="text-xs font-bold text-emerald-400">
          In stock — {qty} line{qty !== 1 ? "s" : ""} available
        </p>
      ) : (
        <p className="text-xs font-bold text-red-400">Out of stock</p>
      )}
    </div>
  );
}

// ── Terms Gate — wraps any buy button ─────────────────────────────────────────
const TERMS = [
  { title: "All Sales Final", body: "No refunds will be issued under any circumstances once a purchase is completed." },
  { title: "Delivery", body: "Digital products are delivered instantly upon payment confirmation. Delivery issues must be reported within 24 hours." },
  { title: "Subscription Cancellation", body: "You may cancel your subscription at any time. Access continues until the end of the current billing period. No partial refunds." },
  { title: "Account Responsibility", body: "You are solely responsible for all activity on your account and any accounts delivered to you." },
  { title: "Service Availability", body: "We do not guarantee 100% uptime. No credits or refunds are issued for service interruptions." },
];

function TermsGate({ children }: { children: (agreed: boolean) => React.ReactNode }) {
  const [agreed, setAgreed] = useState(false);
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="space-y-2">
      <div className="rounded-lg border border-orange-400/20 bg-zinc-800/60 p-3">
        <label className="flex cursor-pointer items-start gap-2.5">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 rounded accent-yellow-400"
          />
          <span className="text-xs font-bold text-orange-300">
            I agree to the{" "}
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="underline text-orange-400 hover:text-orange-300"
            >
              Terms &amp; Conditions
            </button>
            {" "}— All sales are final. No refunds.
          </span>
        </label>

        {expanded && (
          <div className="mt-3 space-y-2 border-t border-orange-400/20 pt-3">
            {TERMS.map((t) => (
              <div key={t.title}>
                <p className="text-xs font-bold text-orange-400">{t.title}</p>
                <p className="text-xs font-semibold text-orange-300/80">{t.body}</p>
              </div>
            ))}
          </div>
        )}
      </div>
      {children(agreed)}
    </div>
  );
}

// ── Server Plan Card (subscription) ───────────────────────────────────────────
function StockPlanCard({
  plan,
  onSubscribe,
  busy,
}: {
  plan: PlanCard;
  onSubscribe: (slug: string) => void;
  busy: string | null;
}) {
  const isBusy = busy === plan.slug;
  const inStock = plan.available;

  return (
    <div
      className="relative flex flex-col rounded-2xl border border-orange-400/50 bg-zinc-900 p-6 shadow-sm transition hover:border-orange-400"
    >
      {plan.badge && inStock && (
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
      <ul className="mb-4 space-y-1.5 text-sm font-semibold text-orange-300">
        {plan.features.map((feat, i) => (
          <li key={i} className="flex items-center gap-2"><GoldCheck /> {feat}</li>
        ))}
      </ul>
      <StockBadge qty={plan.poolQuantity} packSize={plan.packSize} />
      <TermsGate>
        {(agreed) => (
          <button
            onClick={() => inStock && agreed && onSubscribe(plan.slug)}
            disabled={!inStock || !agreed || busy !== null}
            className={`mt-auto w-full rounded-xl py-3 text-sm font-bold transition ${
              inStock && agreed
                ? "bg-orange-500 text-black hover:bg-orange-400 disabled:opacity-60"
                : "cursor-not-allowed bg-zinc-700 text-zinc-500"
            }`}
          >
            {isBusy ? (
              <span className="flex items-center justify-center gap-2"><Spinner /> Redirecting…</span>
            ) : !inStock ? (
              "Out of Stock"
            ) : !agreed ? (
              "Agree to T&C to Continue"
            ) : (
              `Subscribe — ${fmt(plan.priceCents)}/mo`
            )}
          </button>
        )}
      </TermsGate>
    </div>
  );
}

// ── ACC Card (one-time purchase with quantity) ─────────────────────────────────
function ACCCard({
  plan,
  onBuy,
  busy,
}: {
  plan: PlanCard;
  onBuy: (slug: string, qty: number) => void;
  busy: string | null;
}) {
  const [qty, setQty] = useState(1);
  const isBusy = busy === plan.slug;
  const inStock = plan.available;
  const maxQty = plan.poolQuantity;
  const totalCents = qty * plan.priceCents;

  return (
    <div
      className="relative flex flex-col rounded-2xl border border-orange-400/50 bg-zinc-900 p-6 shadow-sm transition hover:border-orange-400"
    >
      <div className="mb-4">
        <p className="text-xs font-bold uppercase tracking-widest text-orange-400">Retail Account</p>
        <h3 className="mt-1 text-lg font-extrabold text-orange-400">{plan.name}</h3>
        <p className="mt-1 text-sm font-semibold text-orange-300">{plan.description}</p>
      </div>
      <div className="mb-4">
        <span className="text-3xl font-extrabold text-orange-400">{fmt(plan.priceCents)}</span>
        <span className="ml-1 text-sm font-semibold text-orange-300">each</span>
      </div>
      <ul className="mb-4 space-y-1.5 text-sm font-semibold text-orange-300">
        {plan.features.map((feat, i) => (
          <li key={i} className="flex items-center gap-2"><GoldCheck /> {feat}</li>
        ))}
      </ul>
      <div className="mb-3">
        <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-orange-400">Quantity</label>
        <input
          type="number"
          min={1}
          max={maxQty}
          value={qty}
          onChange={(e) => {
            const v = parseInt(e.target.value, 10);
            if (!isNaN(v) && v >= 1 && v <= maxQty) setQty(v);
          }}
          className="w-full rounded-lg border border-orange-400/40 bg-zinc-800 px-3 py-2.5 text-sm font-semibold text-orange-300 focus:border-orange-400 focus:outline-none"
        />
      </div>
      <div className="mb-4 rounded-lg border border-orange-400/20 bg-zinc-800 px-3 py-2">
        <p className="text-xs font-bold text-orange-300">
          Total: <span className="text-orange-400">{fmt(totalCents)}</span>
          <span className="ml-1 font-semibold text-orange-300/60">({qty} × {fmt(plan.priceCents)})</span>
        </p>
      </div>
      <StockBadge qty={plan.poolQuantity} packSize={1} />
      <TermsGate>
        {(agreed) => (
          <button
            onClick={() => inStock && agreed && onBuy(plan.slug, qty)}
            disabled={!inStock || !agreed || busy !== null || qty < 1}
            className={`mt-auto w-full rounded-xl py-3 text-sm font-bold transition ${
              inStock && agreed
                ? "bg-orange-500 text-black hover:bg-orange-400 disabled:opacity-60"
                : "cursor-not-allowed bg-zinc-700 text-zinc-500"
            }`}
          >
            {isBusy ? (
              <span className="flex items-center justify-center gap-2"><Spinner /> Redirecting…</span>
            ) : !inStock ? (
              "Out of Stock"
            ) : !agreed ? (
              "Agree to T&C to Continue"
            ) : (
              `Buy Now — ${fmt(totalCents)}`
            )}
          </button>
        )}
      </TermsGate>
    </div>
  );
}

// ── Private Subnet Placeholder Card ───────────────────────────────────────────
function SubnetCard() {
  return (
    <div className="relative flex flex-col rounded-2xl border border-orange-400/50 bg-zinc-900 p-6 shadow-sm transition hover:border-orange-400">
      <span className="absolute -top-3 left-5 rounded-full bg-yellow-400 px-3 py-0.5 text-xs font-bold text-black">
        Pre-Order
      </span>
      <div className="mb-4">
        <p className="text-xs font-bold uppercase tracking-widest text-orange-400">Private Subnet</p>
        <h3 className="mt-1 text-lg font-extrabold text-orange-400">PRIVATE SUBNET</h3>
        <p className="mt-1 text-sm font-semibold text-orange-300">
          Dedicated private subnet — your choice of carrier.
        </p>
      </div>
      <div className="mb-4">
        <span className="text-3xl font-extrabold text-orange-400">$450</span>
        <span className="ml-1 text-sm font-semibold text-orange-300">/ 254 ISPs</span>
      </div>
      <ul className="mb-4 space-y-1.5 text-sm font-semibold text-orange-300">
        {[
          "Your Choice: Sprint, RCN, AT&T, Windstream",
          "Open 24/7",
          "Ashburn Location",
          "30 Day Duration",
        ].map((feat, i) => (
          <li key={i} className="flex items-center gap-2"><GoldCheck /> {feat}</li>
        ))}
      </ul>
      <div className="mb-4 rounded-lg border border-yellow-400/30 bg-yellow-400/10 px-3 py-2">
        <p className="text-xs font-bold text-yellow-400">All Private Subnets are done on Pre-orders</p>
      </div>
      <a
        href="mailto:info.5starmedia@gmail.com?subject=Private Subnet Pre-Order"
        className="mt-auto w-full rounded-xl bg-orange-500 py-3 text-center text-sm font-bold text-black transition hover:bg-orange-400"
      >
        Contact Team
      </a>
    </div>
  );
}

// ── ISP Proxy Card ─────────────────────────────────────────────────────────────
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
  const poolQty = selectedPlan?.poolQuantity ?? 0;

  return (
    <div className="relative flex flex-col rounded-2xl border border-orange-400/50 bg-zinc-900 p-6 shadow-sm transition hover:border-orange-400">
      <div className="mb-4">
        <p className="text-xs font-bold uppercase tracking-widest text-orange-400">ISP Proxies</p>
        <h3 className="mt-1 text-lg font-extrabold text-orange-400">Viking USA ISP</h3>
        <p className="mt-1 text-sm font-semibold text-orange-300">
          Premium USA ISP proxies — monthly subscription.
        </p>
      </div>
      <div className="mb-4">
        <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-orange-400">Quantity</label>
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
      {selectedPlan && (
        <div className="mb-4">
          <span className="text-3xl font-extrabold text-orange-400">{fmt(selectedPlan.priceCents)}</span>
          <span className="ml-1 text-sm font-semibold text-orange-300">/month</span>
        </div>
      )}
      <ul className="mb-4 space-y-1.5 text-sm font-semibold text-orange-300">
        {[
          `${selectedQty} proxies included`,
          "Private datacenter / USA",
          "Ashburn, VA",
          "10GB/s Network Speed",
          "Unlocked 24/7",
          "Instant Delivery",
        ].map((feat, i) => (
          <li key={i} className="flex items-center gap-2"><GoldCheck /> {feat}</li>
        ))}
      </ul>
      <StockBadge qty={poolQty} packSize={selectedQty} />
      <TermsGate>
        {(agreed) => (
          <button
            onClick={() => selectedPlan && isAvailable && agreed && onSubscribe(selectedPlan.slug)}
            disabled={!isAvailable || !selectedPlan || !agreed || busy !== null}
            className={`mt-auto w-full rounded-xl py-3 text-sm font-bold transition ${
              isAvailable && selectedPlan && agreed
                ? "bg-orange-500 text-black hover:bg-orange-400 disabled:opacity-60"
                : "cursor-not-allowed bg-zinc-700 text-zinc-500"
            }`}
          >
            {isBusy ? (
              <span className="flex items-center justify-center gap-2"><Spinner /> Redirecting…</span>
            ) : !isAvailable || !selectedPlan ? (
              "Out of Stock"
            ) : !agreed ? (
              "Agree to T&C to Continue"
            ) : (
              `Subscribe — ${fmt(selectedPlan.priceCents)}/mo`
            )}
          </button>
        )}
      </TermsGate>
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
        <p className="text-sm font-bold text-emerald-400">Order confirmed — thank you!</p>
        <p className="mt-0.5 text-xs font-semibold text-emerald-300">
          Your product will appear in <strong>My Orders</strong> shortly.
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
            {new Date(order.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
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
                  <p className="mb-1.5 text-xs font-bold text-blue-400">
                    Your {item.quantity} line{item.quantity !== 1 ? "s" : ""}
                  </p>
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

// ── Billing Section ────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; color: string; dot: string; desc: string }> = {
  active: { label: "Active", color: "text-emerald-400", dot: "bg-emerald-500", desc: "Your subscription is active and in good standing." },
  trialing: { label: "Trial", color: "text-blue-400", dot: "bg-blue-500", desc: "You are currently in a free trial period." },
  past_due: { label: "Past Due", color: "text-amber-400", dot: "bg-amber-500", desc: "Your last payment failed. Please update your payment method." },
  canceled: { label: "Cancelled", color: "text-red-400", dot: "bg-red-400", desc: "Your subscription has been cancelled." },
  cancelled: { label: "Cancelled", color: "text-red-400", dot: "bg-red-400", desc: "Your subscription has been cancelled." },
  incomplete: { label: "Incomplete", color: "text-zinc-400", dot: "bg-zinc-400", desc: "Your subscription setup is incomplete." },
  pending: { label: "Pending", color: "text-zinc-400", dot: "bg-zinc-400", desc: "Your subscription is being set up." },
};

function fmtDate(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function BillingSection({ onGoProducts }: { onGoProducts: () => void }) {
  const [sub, setSub] = useState<SubData | undefined>(undefined);
  const [subLoading, setSubLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<null | "checkout" | "portal">(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/stripe/subscription")
      .then((r) => r.json())
      .then((d) => setSub(d.subscription ?? null))
      .catch(() => setSub(null))
      .finally(() => setSubLoading(false));
  }, []);

  async function goPortal() {
    setError(null);
    setActionLoading("portal");
    try {
      const res = await fetch("/api/stripe/create-portal-session", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Portal failed");
      if (!data.url) throw new Error("No portal URL returned");
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open billing portal.");
      setActionLoading(null);
    }
  }

  async function goCheckout() {
    setError(null);
    setActionLoading("checkout");
    try {
      const res = await fetch("/api/stripe/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Checkout failed");
      if (!data.url) throw new Error("No checkout URL returned");
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed.");
      setActionLoading(null);
    }
  }

  const isActive = sub?.status === "active" || sub?.status === "trialing";
  const isPastDue = sub?.status === "past_due";
  const isCancelled = sub?.status === "canceled" || sub?.status === "cancelled";
  const statusInfo = sub ? (STATUS_CONFIG[sub.status] ?? STATUS_CONFIG["pending"]) : null;

  return (
    <div className="max-w-lg">
      <div className="rounded-2xl border border-orange-400/30 bg-zinc-900 p-6 shadow-sm">
        <h2 className="mb-5 text-lg font-extrabold text-orange-400">Subscription &amp; Billing</h2>
        {subLoading ? (
          <div className="flex items-center gap-2 text-sm font-semibold text-orange-400">
            <Spinner /> Checking subscription…
          </div>
        ) : sub && statusInfo ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-xl border border-orange-400/20 bg-zinc-800 px-4 py-3">
              <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${statusInfo.dot}`} />
              <div>
                <p className={`text-sm font-bold ${statusInfo.color}`}>{statusInfo.label}</p>
                <p className="text-xs font-semibold text-orange-300/70">{statusInfo.desc}</p>
              </div>
            </div>
            {sub.currentPeriodEnd && (
              <p className="text-xs font-semibold text-orange-300">
                {sub.cancelAtPeriodEnd ? `Access ends on ${fmtDate(sub.currentPeriodEnd)}` : isActive ? `Renews on ${fmtDate(sub.currentPeriodEnd)}` : `Period ended ${fmtDate(sub.currentPeriodEnd)}`}
              </p>
            )}
            <div className="flex flex-wrap gap-3 pt-1">
              {(isActive || isPastDue) && (
                <button onClick={goPortal} disabled={actionLoading !== null} className="rounded-xl bg-orange-500 px-5 py-2.5 text-sm font-bold text-black transition hover:bg-orange-400 disabled:opacity-50">
                  {actionLoading === "portal" ? <span className="flex items-center gap-2"><Spinner /> Redirecting…</span> : "Manage Subscription"}
                </button>
              )}
              {(isCancelled || (!isActive && !isPastDue)) && (
                <button onClick={goCheckout} disabled={actionLoading !== null} className="rounded-xl bg-orange-500 px-5 py-2.5 text-sm font-bold text-black transition hover:bg-orange-400 disabled:opacity-50">
                  {actionLoading === "checkout" ? <span className="flex items-center gap-2"><Spinner /> Redirecting…</span> : "Subscribe Now"}
                </button>
              )}
              {isPastDue && (
                <button onClick={goCheckout} disabled={actionLoading !== null} className="rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-bold text-black transition hover:bg-amber-400 disabled:opacity-50">
                  {actionLoading === "checkout" ? <span className="flex items-center gap-2"><Spinner /> Redirecting…</span> : "Update Payment Method"}
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-xl border border-orange-400/20 bg-zinc-800 px-4 py-4">
              <p className="text-sm font-bold text-orange-400">No active subscription</p>
              <p className="mt-1 text-xs font-semibold text-orange-300">Subscribe to get full access to all products and features.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button onClick={goCheckout} disabled={actionLoading !== null} className="rounded-xl bg-orange-500 px-5 py-2.5 text-sm font-bold text-black transition hover:bg-orange-400 disabled:opacity-50">
                {actionLoading === "checkout" ? <span className="flex items-center gap-2"><Spinner /> Redirecting…</span> : "Subscribe Now"}
              </button>
              <button onClick={onGoProducts} className="rounded-xl border border-orange-400/40 px-5 py-2.5 text-sm font-bold text-orange-400 transition hover:bg-zinc-800">
                Browse Products
              </button>
            </div>
          </div>
        )}
        {error && (
          <div className="mt-4 rounded-xl border border-red-500/40 bg-red-900/30 px-4 py-3 text-sm font-semibold text-red-400">{error}</div>
        )}
      </div>
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
  const [activeTab, setActiveTab] = useState<"products" | "orders" | "billing">(
    purchaseResult === "success" ? "orders" : "products"
  );
  const [subscribeBusy, setSubscribeBusy] = useState<string | null>(null);
  const [subscribeError, setSubscribeError] = useState<string | null>(null);
  const [banner, setBanner] = useState<"success" | "cancelled" | null>(purchaseResult);

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

  async function handleBuy(planSlug: string, qty: number = 1) {
    setSubscribeError(null);
    setSubscribeBusy(planSlug);
    try {
      const res = await fetch("/api/stripe/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planSlug, quantity: qty }),
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

  const handleSubscribe = (slug: string) => handleBuy(slug, 1);

  if (status === "loading") {
    return (
      <div className="flex h-64 items-center justify-center gap-2 text-sm font-bold text-orange-400">
        <Spinner size="lg" /> Loading…
      </div>
    );
  }

  if (!session) return null;

  const email = session.user?.email ?? "";
  const sessionUser = session.user as { role?: string; isAdmin?: boolean; isPromoter?: boolean };
  const isPromoter = sessionUser?.isPromoter === true;
  const totalItems = orders.reduce(
    (s, o) => s + o.lineItems.reduce((ls, li) => ls + li.quantity, 0),
    0
  );

  // Group plans by type — order: ISP → Server → ACC (subnet is static)
  const ispPlans    = plans.filter((p) => p.inventorySku === ISP_POOL_SKU);
  const serverPlans = plans.filter((p) => p.inventorySku !== ISP_POOL_SKU && !p.oneTime);
  const accPlans    = plans.filter((p) => p.oneTime === true);

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-6 px-6 py-10">
      {/* Header */}
      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-orange-400">Dashboard</p>
        <h1 className="text-3xl font-extrabold text-orange-400">Welcome back</h1>
        <p className="mt-1 text-sm font-bold text-orange-300">
          {email}
          {sessionUser?.isAdmin && (
            <span className="ml-2 inline-flex items-center rounded-full bg-orange-500/20 px-2 py-0.5 text-xs font-bold text-orange-400">admin</span>
          )}
          {isPromoter && !sessionUser?.isAdmin && (
            <span className="ml-2 inline-flex items-center rounded-full bg-yellow-400/20 px-2 py-0.5 text-xs font-bold text-yellow-400">promoter</span>
          )}
        </p>
        {isPromoter && (
          <a href="/dashboard/promo" className="mt-1 inline-block text-xs font-bold text-yellow-400 underline hover:text-yellow-300">
            View My Promo Stats →
          </a>
        )}
      </div>

      {banner && <PurchaseBanner type={banner} onDismiss={() => setBanner(null)} />}

      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-2">
        {[{ label: "Total Orders", value: orders.length }, { label: "Items Purchased", value: totalItems }].map((c) => (
          <div key={c.label} className="rounded-xl border border-orange-400/30 bg-zinc-900 px-5 py-4 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wide text-orange-400">{c.label}</p>
            <p className="mt-1 text-3xl font-extrabold text-orange-400">{c.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="border-b border-orange-400/30">
        <div className="flex">
          {(["products", "orders", "billing"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`border-b-2 px-5 py-3 text-sm font-bold transition ${
                activeTab === tab ? "border-orange-400 text-orange-400" : "border-transparent text-orange-300/60 hover:text-orange-400"
              }`}
            >
              {tab === "products" ? "Products" : tab === "orders" ? `My Orders${orders.length > 0 ? ` (${orders.length})` : ""}` : "Billing"}
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
              {/* Order: ISP → Server → Private Subnet → Hybrid ACC */}
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {ispPlans.length > 0 && (
                  <ISPProxyCard ispPlans={ispPlans} onSubscribe={handleSubscribe} busy={subscribeBusy} />
                )}
                {serverPlans.map((plan) => (
                  <StockPlanCard key={plan.slug} plan={plan} onSubscribe={handleSubscribe} busy={subscribeBusy} />
                ))}
                <SubnetCard />
                {accPlans.map((plan) => (
                  <ACCCard key={plan.slug} plan={plan} onBuy={handleBuy} busy={subscribeBusy} />
                ))}
              </div>
              <p className="mt-2 text-xs font-semibold text-orange-300/60">
                ISP and Server plans are monthly recurring subscriptions. VIKING HYBRID RETAIL ACC is a one-time purchase. Private Subnet is pre-order only.
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
            <div className="rounded-xl border border-orange-400/20 bg-zinc-900 px-5 py-8 text-center">
              <p className="text-sm font-semibold text-orange-300">No orders yet.</p>
              <button onClick={() => setActiveTab("products")} className="mt-3 text-sm font-bold text-orange-400 underline hover:text-orange-300">
                Browse products →
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {orders.map((order) => (
                <OrderCard key={order.id} order={order} />
              ))}
            </div>
          )}
        </>
      )}

      {/* Billing tab */}
      {activeTab === "billing" && (
        <BillingSection onGoProducts={() => setActiveTab("products")} />
      )}
    </div>
  );
}
