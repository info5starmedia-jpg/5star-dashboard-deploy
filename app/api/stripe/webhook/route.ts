import { NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import {
  sendDiscordAlert,
  notifyNewOrder,
  notifyRenewal,
  notifyCancellation,
  notifyPaymentFailed,
  notifyPastDue,
  notifyChargeback,
  notifyPoolLow,
} from "@/lib/alerts";
import { logAudit } from "@/lib/audit";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";

export const runtime = "nodejs";

// Stripe v20 removed current_period_end and cancel_at_period_end from the
// typed Subscription object. We define our own loose shape so we never do
// unsafe property access on the typed object directly.
type SubscriptionRaw = {
  id: string;
  status: string;
  customer?: string | Stripe.Customer | Stripe.DeletedCustomer | null;
  customer_email?: string | null;
  current_period_end?: number | null;
  cancel_at_period_end?: boolean | null;
  items?: { data: Array<{ price?: { id: string } }> };
  metadata?: Record<string, string>;
};

const ISP_LOW_STOCK_THRESHOLD = 50;

async function getRawBody(request: Request) {
  return await request.text();
}

function getSignature(request: Request) {
  return request.headers.get("stripe-signature") || "";
}

async function resolveUserEmailFromSubscription(sub: SubscriptionRaw): Promise<string | null> {
  if (sub?.customer_email && typeof sub.customer_email === "string") return sub.customer_email;
  if (sub?.metadata?.userEmail) return sub.metadata.userEmail;

  const customerId =
    typeof sub?.customer === "string"
      ? sub.customer
      : sub?.customer && typeof sub.customer === "object" && "id" in sub.customer
        ? (sub.customer as { id: string }).id
        : null;

  if (!customerId) return null;

  const customer = await stripe.customers.retrieve(customerId);
  if ("deleted" in customer && customer.deleted) return null;

  return customer.email || null;
}

// Track promo code usage from a completed checkout session
async function trackPromoUsage(session: Stripe.Checkout.Session, userEmail: string) {
  try {
    // Expand discount details if not already present
    let promoCodeId: string | null = null;

    // Try from session discount
    if (session.total_details?.breakdown) {
      const discounts = (session.total_details.breakdown as { discounts?: Array<{ discount?: { promotion_code?: string | null } }> }).discounts;
      if (discounts?.length) {
        const raw = discounts[0]?.discount?.promotion_code;
        promoCodeId = typeof raw === "string" ? raw : null;
      }
    }

    // Fallback: retrieve full session with expansion
    if (!promoCodeId) {
      try {
        const expanded = await stripe.checkout.sessions.retrieve(session.id, {
          expand: ["total_details.breakdown.discounts"],
        });
        const discounts = (expanded.total_details?.breakdown as { discounts?: Array<{ discount?: { promotion_code?: string | Stripe.PromotionCode | null } }> } | null)?.discounts;
        if (discounts?.length) {
          const raw = discounts[0]?.discount?.promotion_code;
          promoCodeId = typeof raw === "string" ? raw : (raw as { id?: string } | null)?.id ?? null;
        }
      } catch { /* best-effort */ }
    }

    if (!promoCodeId) return;

    const promoCode = await prisma.promoCode.findFirst({
      where: { stripePromoId: promoCodeId },
    });

    if (!promoCode) return;

    const amountCents = session.amount_total ?? 0;

    await prisma.promoCodeUsage.create({
      data: {
        promoCodeId: promoCode.id,
        code: promoCode.code,
        promoter: promoCode.promoter,
        customerEmail: userEmail,
        orderId: session.id,
        amountCents,
      },
    });

    await prisma.promoCode.update({
      where: { id: promoCode.id },
      data: {
        totalUses: { increment: 1 },
        totalRevenueCents: { increment: amountCents },
      },
    });
  } catch { /* best-effort — never fail the webhook */ }
}

export async function POST(request: Request) {
  const contentLength = request.headers.get("content-length");
  if (contentLength && parseInt(contentLength, 10) > 524_288) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json({ error: "Missing STRIPE_WEBHOOK_SECRET" }, { status: 500 });
  }

  const sig = getSignature(request);
  const rawBody = await getRawBody(request);

  if (rawBody.length > 524_288) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "invalid signature";
    return NextResponse.json({ error: `Webhook Error: ${message}` }, { status: 400 });
  }

  // Idempotency: claim the event before processing. Only a real unique-constraint
  // violation (P2002) means it was already processed; any other DB error must be
  // surfaced (rethrown) rather than silently swallowed as a duplicate.
  try {
    await prisma.stripeEvent.create({ data: { id: event.id, type: event.type } });
  } catch (err) {
    if (err instanceof PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json({ received: true, duplicate: true });
    }
    throw err;
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userEmail =
          session?.metadata?.userEmail || session?.customer_details?.email || null;

        if (!userEmail) break;

        // ── Product purchase (one-time payment) ──────────────────────────────
        if (session.metadata?.type === "product_purchase" && session.metadata?.sku) {
          const { sku, itemName } = session.metadata;
          const quantity = parseInt(session.metadata.quantity ?? "1", 10);

          // Amount actually charged (after any promo code discount)
          const amountTotal = session.amount_total ?? 0;
          const unitPriceCents = quantity > 0 ? Math.round(amountTotal / quantity) : amountTotal;

          await prisma.$transaction(async (tx) => {
            const item = await tx.inventoryItem.findUnique({ where: { sku } });
            if (!item) throw new Error(`SKU not found: ${sku}`);
            if (item.quantity < quantity) throw new Error(`Insufficient stock for ${sku}`);

            // Content delivery: hand out per-item delivery lines to the buyer and
            // keep the remainder in inventory.
            let deliveredContent: string | null = null;
            let remainingContent: string | null = item.content;
            if (item.content) {
              const allLines = item.content.split("\n").filter((l: string) => l.trim());
              if (allLines.length < quantity) throw new Error(`Not enough content lines for ${sku}`);
              const taken = allLines.slice(0, quantity);
              const remaining = allLines.slice(quantity);
              deliveredContent = taken.join("\n");
              remainingContent = remaining.length > 0 ? remaining.join("\n") : null;
            }

            await tx.inventoryItem.update({
              where: { sku },
              data: {
                quantity: { decrement: quantity },
                ...(item.content !== null ? { content: remainingContent } : {}),
              },
            });
            await tx.invoice.create({
              data: {
                createdByEmail: userEmail,
                customerEmail: userEmail,
                subtotalCents: amountTotal,
                taxCents: 0,
                totalCents: amountTotal,
                status: "issued",
                lineItems: {
                  create: [{
                    description: itemName ?? item.name,
                    sku,
                    quantity,
                    unitPriceCents,
                    totalCents: amountTotal,
                    deliveredContent,
                  }],
                },
              },
            });
          });

          await logAudit({ actorEmail: userEmail, action: "user_purchase", targetEmail: userEmail, ip: null, userAgent: null });

          await notifyNewOrder({
            customerEmail: userEmail,
            productName: itemName ?? sku,
            quantity,
            amountCents: amountTotal,
            linesDelivered: quantity,
            sku,
          });

          // Track promo code usage for one-time purchases
          await trackPromoUsage(session, userEmail);
          break;
        }

        // ── Plan-based subscription initial delivery ─────────────────────────
        if (session.metadata?.planSlug && session.metadata.planSlug !== "default") {
          const { getPlanBySlug } = await import("@/lib/constants");
          const plan = getPlanBySlug(session.metadata.planSlug);

          if (plan) {
            const amountTotal = session.amount_total ?? 0;
            const poolItem = await prisma.inventoryItem.findUnique({ where: { sku: plan.inventorySku } });

            if (poolItem && poolItem.content && poolItem.quantity >= plan.packSize) {
              let remainingAfterDelivery = 0;

              await prisma.$transaction(async (tx) => {
                const fresh = await tx.inventoryItem.findUnique({ where: { sku: plan.inventorySku } });
                if (!fresh || !fresh.content) throw new Error(`Pool not found: ${plan.inventorySku}`);
                if (fresh.quantity < plan.packSize) throw new Error(`Insufficient stock in ${plan.inventorySku}`);

                const allLines = fresh.content.split("\n").filter((l: string) => l.trim());
                if (allLines.length < plan.packSize) throw new Error(`Not enough content lines in ${plan.inventorySku}`);

                const taken = allLines.slice(0, plan.packSize);
                const remaining = allLines.slice(plan.packSize);
                const deliveredContent = taken.join("\n");
                const remainingContent = remaining.length > 0 ? remaining.join("\n") : null;
                remainingAfterDelivery = remaining.length;

                await tx.inventoryItem.update({
                  where: { sku: plan.inventorySku },
                  data: { quantity: { decrement: plan.packSize }, content: remainingContent },
                });

                await tx.invoice.create({
                  data: {
                    createdByEmail: userEmail,
                    customerEmail: userEmail,
                    subtotalCents: amountTotal,
                    taxCents: 0,
                    totalCents: amountTotal,
                    status: "issued",
                    lineItems: {
                      create: [{
                        description: `${plan.name} — Initial Delivery`,
                        sku: plan.inventorySku,
                        quantity: plan.packSize,
                        unitPriceCents: Math.round(amountTotal / plan.packSize),
                        totalCents: amountTotal,
                        deliveredContent,
                      }],
                    },
                  },
                });
              });

              await notifyNewOrder({
                customerEmail: userEmail,
                productName: plan.name,
                quantity: plan.packSize,
                amountCents: amountTotal,
                linesDelivered: plan.packSize,
                sku: plan.inventorySku,
              });

              if (remainingAfterDelivery < ISP_LOW_STOCK_THRESHOLD) {
                await notifyPoolLow({ sku: plan.inventorySku, remaining: remainingAfterDelivery });
              }

              // Track promo code usage for subscription purchases
              await trackPromoUsage(session, userEmail);
            } else {
              await sendDiscordAlert(
                `⚠️ Manual delivery needed — **${userEmail}** subscribed to ${plan.name} but inventory [${plan.inventorySku}] is insufficient.`
              );
            }
          }
        }

        // ── Subscription checkout ─────────────────────────────────────────────
        const customerId =
          typeof session?.customer === "string"
            ? session.customer
            : session?.customer && typeof session.customer === "object" && "id" in session.customer
              ? (session.customer as { id: string }).id
              : null;

        const subscriptionId =
          typeof session?.subscription === "string"
            ? session.subscription
            : session?.subscription && typeof session.subscription === "object" && "id" in session.subscription
              ? (session.subscription as { id: string }).id
              : null;

        if (!customerId) break;

        let subStatus = "active";
        let priceId = process.env.STRIPE_PRICE_ID_MONTHLY || "";
        let currentPeriodEnd: Date | null = null;
        let cancelAtPeriodEnd = false;

        if (subscriptionId) {
          try {
            const sub = await stripe.subscriptions.retrieve(subscriptionId) as unknown as SubscriptionRaw;
            subStatus = sub.status;
            priceId = sub.items?.data?.[0]?.price?.id || priceId;
            currentPeriodEnd = typeof sub.current_period_end === "number" ? new Date(sub.current_period_end * 1000) : null;
            cancelAtPeriodEnd = !!sub.cancel_at_period_end;
          } catch { /* fall back */ }
        }

        if (subscriptionId) {
          await prisma.subscription.upsert({
            where: { stripeSubscriptionId: subscriptionId },
            create: { userEmail, stripeCustomerId: customerId, stripeSubscriptionId: subscriptionId, priceId, status: subStatus, currentPeriodEnd, cancelAtPeriodEnd },
            update: { userEmail, stripeCustomerId: customerId, priceId, status: subStatus, currentPeriodEnd, cancelAtPeriodEnd },
          });
        } else {
          const existing = await prisma.subscription.findFirst({ where: { userEmail }, orderBy: { createdAt: "desc" } });
          if (existing) {
            await prisma.subscription.update({ where: { id: existing.id }, data: { stripeCustomerId: customerId, status: subStatus, priceId, currentPeriodEnd, cancelAtPeriodEnd } });
          } else {
            await prisma.subscription.create({ data: { userEmail, stripeCustomerId: customerId, stripeSubscriptionId: `pending_${Date.now()}`, priceId, status: subStatus, currentPeriodEnd, cancelAtPeriodEnd } });
          }
        }
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as unknown as SubscriptionRaw;
        const userEmail = await resolveUserEmailFromSubscription(sub);
        if (!userEmail) break;

        const customerId =
          typeof sub?.customer === "string" ? sub.customer
            : sub?.customer && typeof sub.customer === "object" && "id" in sub.customer
              ? (sub.customer as { id: string }).id : "";
        const priceId = sub.items?.data?.[0]?.price?.id || process.env.STRIPE_PRICE_ID_MONTHLY || "";
        const status = sub.status || "unknown";
        const cancelAtPeriodEnd = !!sub.cancel_at_period_end;
        const cpe = sub.current_period_end;
        const currentPeriodEnd = typeof cpe === "number" ? new Date(cpe * 1000) : null;

        const { getPlanByPriceId: getPlanByPriceIdSub } = await import("@/lib/constants");
        const subPlan = getPlanByPriceIdSub(priceId);

        if (event.type === "customer.subscription.deleted") {
          await notifyCancellation({ customerEmail: userEmail, planName: subPlan?.name, subscriptionId: sub.id });
          await logAudit({ actorEmail: userEmail, action: "subscription_cancelled", targetEmail: userEmail, ip: null, userAgent: null });
        } else if (status === "past_due") {
          await notifyPastDue({ customerEmail: userEmail, subscriptionId: sub.id });
        }

        try {
          await prisma.subscription.upsert({
            where: { stripeSubscriptionId: sub.id },
            create: { userEmail, stripeCustomerId: customerId || "", stripeSubscriptionId: sub.id, priceId, status, currentPeriodEnd, cancelAtPeriodEnd },
            update: { userEmail, stripeCustomerId: customerId || undefined, priceId, status, currentPeriodEnd, cancelAtPeriodEnd },
          });
        } catch (err) {
          if (err instanceof PrismaClientKnownRequestError) {
            const pending = await prisma.subscription.findFirst({ where: { userEmail, stripeCustomerId: customerId }, orderBy: { createdAt: "desc" } });
            if (pending) {
              await prisma.subscription.update({ where: { id: pending.id }, data: { stripeSubscriptionId: sub.id, priceId, status, currentPeriodEnd, cancelAtPeriodEnd } });
            }
          } else { throw err; }
        }
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice & {
          subscription?: string | null;
          customer_email?: string | null;
          billing_reason?: string | null;
          amount_paid?: number;
        };

        if (invoice.billing_reason !== "subscription_cycle") break;

        const userEmail = invoice.customer_email ?? null;
        if (!userEmail) break;

        const subId = typeof invoice.subscription === "string" ? invoice.subscription : null;
        const subRecord = subId ? await prisma.subscription.findFirst({ where: { stripeSubscriptionId: subId } }) : null;

        const { getPlanByPriceId } = await import("@/lib/constants");
        const plan = subRecord ? getPlanByPriceId(subRecord.priceId) : null;

        await logAudit({ actorEmail: userEmail, action: "subscription_renewal", targetEmail: userEmail, ip: null, userAgent: null });

        await notifyRenewal({
          customerEmail: userEmail,
          planName: plan?.name ?? "Subscription",
          amountCents: invoice.amount_paid ?? 0,
          nextRenewal: subRecord?.currentPeriodEnd ?? null,
        });
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice & {
          subscription?: string | null;
          customer_email?: string | null;
          amount_due?: number;
        };

        const userEmail = invoice.customer_email ?? null;
        if (!userEmail) break;

        const subId = typeof invoice.subscription === "string" ? invoice.subscription : null;

        if (subId) {
          await prisma.subscription.updateMany({ where: { stripeSubscriptionId: subId }, data: { status: "past_due" } });
        }

        await logAudit({ actorEmail: userEmail, action: "payment_failed", targetEmail: userEmail, ip: null, userAgent: null });
        await notifyPaymentFailed({ customerEmail: userEmail, subscriptionId: subId, amountCents: invoice.amount_due ?? 0 });
        break;
      }

      case "charge.dispute.created": {
        const dispute = event.data.object as Stripe.Dispute;
        await notifyChargeback({ amountCents: dispute.amount, reason: dispute.reason, status: dispute.status });
        break;
      }

      default:
        break;
    }

    return NextResponse.json({ received: true });
  } catch (error: unknown) {
    // Release the idempotency claim: the event was recorded BEFORE processing,
    // so without this a failed handler makes Stripe's retry hit the duplicate
    // guard and the event is never processed (charged but unfulfilled).
    await prisma.stripeEvent.delete({ where: { id: event.id } }).catch(() => {});
    const message = error instanceof Error ? error.message : "Webhook handler failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
