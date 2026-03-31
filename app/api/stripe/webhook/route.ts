import { NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { sendDiscordAlert } from "@/lib/alerts";
import { logAudit } from "@/lib/audit";

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

export async function POST(request: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json({ error: "Missing STRIPE_WEBHOOK_SECRET" }, { status: 500 });
  }

  const sig = getSignature(request);
  const rawBody = await getRawBody(request);

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "invalid signature";
    return NextResponse.json({ error: `Webhook Error: ${message}` }, { status: 400 });
  }

  // Idempotency: skip already-processed events
  try {
    await prisma.stripeEvent.create({ data: { id: event.id, type: event.type } });
  } catch {
    return NextResponse.json({ received: true, duplicate: true });
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
            if (!item || item.quantity < quantity) {
              throw new Error(`Insufficient stock for ${sku}`);
            }
            await tx.inventoryItem.update({
              where: { sku },
              data: { quantity: { decrement: quantity } },
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
                  create: [
                    {
                      description: itemName ?? item.name,
                      sku,
                      quantity,
                      unitPriceCents,
                      totalCents: amountTotal,
                    },
                  ],
                },
              },
            });
          });

          await logAudit({
            actorEmail: userEmail,
            action: "user_purchase",
            targetEmail: userEmail,
            ip: null,
            userAgent: null,
          });

          const fmt = (c: number) =>
            new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(c / 100);
          await sendDiscordAlert(
            `🛒 New order from **${userEmail}**\n` +
            `• ${quantity}× ${itemName ?? sku}\n` +
            `• Paid: ${fmt(amountTotal)}${amountTotal < quantity * parseInt(session.metadata.unitPriceCents ?? "0", 10) ? " (promo applied ✂️)" : ""}`
          );
          break;
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
            : session?.subscription &&
                typeof session.subscription === "object" &&
                "id" in session.subscription
              ? (session.subscription as { id: string }).id
              : null;

        if (!customerId) break;

        let status = "active";
        let priceId = process.env.STRIPE_PRICE_ID_MONTHLY || "";
        let currentPeriodEnd: Date | null = null;
        let cancelAtPeriodEnd = false;

        if (subscriptionId) {
          try {
            const sub = await stripe.subscriptions.retrieve(subscriptionId) as unknown as SubscriptionRaw;
            status = sub.status;
            priceId = sub.items?.data?.[0]?.price?.id || priceId;
            currentPeriodEnd = typeof sub.current_period_end === "number"
              ? new Date(sub.current_period_end * 1000) : null;
            cancelAtPeriodEnd = !!sub.cancel_at_period_end;
          } catch {
            // fall back to "active" defaults
          }
        }

        await sendDiscordAlert(`💳 New subscription checkout — ${userEmail}`);

        const existing = await prisma.subscription.findFirst({
          where: subscriptionId
            ? { OR: [{ userEmail }, { stripeSubscriptionId: subscriptionId }] }
            : { userEmail },
          orderBy: { createdAt: "desc" },
        });

        if (existing) {
          await prisma.subscription.update({
            where: { id: existing.id },
            data: {
              stripeCustomerId: customerId,
              stripeSubscriptionId: subscriptionId || existing.stripeSubscriptionId,
              status,
              priceId,
              currentPeriodEnd,
              cancelAtPeriodEnd,
            },
          });
        } else {
          await prisma.subscription.create({
            data: {
              userEmail,
              stripeCustomerId: customerId,
              stripeSubscriptionId: subscriptionId || `pending_${Date.now()}`,
              priceId,
              status,
              currentPeriodEnd,
              cancelAtPeriodEnd,
            },
          });
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
          typeof sub?.customer === "string"
            ? sub.customer
            : sub?.customer && typeof sub.customer === "object" && "id" in sub.customer
              ? (sub.customer as { id: string }).id
              : "";
        const priceId =
          sub.items?.data?.[0]?.price?.id || process.env.STRIPE_PRICE_ID_MONTHLY || "";
        const status = sub.status || "unknown";
        const cancelAtPeriodEnd = !!sub.cancel_at_period_end;
        const cpe = sub.current_period_end;
        const currentPeriodEnd = typeof cpe === "number" ? new Date(cpe * 1000) : null;

        // Discord alert for subscription lifecycle events
        if (event.type === "customer.subscription.deleted") {
          await sendDiscordAlert(`🚫 Subscription cancelled — ${userEmail}`);
        } else if (event.type === "customer.subscription.created" && status === "active") {
          await sendDiscordAlert(`✅ New subscription activated — ${userEmail}`);
        }

        const existing = await prisma.subscription.findFirst({
          where: { stripeSubscriptionId: sub.id },
        });

        if (existing) {
          await prisma.subscription.update({
            where: { id: existing.id },
            data: {
              userEmail,
              stripeCustomerId: customerId || existing.stripeCustomerId,
              priceId,
              status,
              currentPeriodEnd,
              cancelAtPeriodEnd,
            },
          });
        } else {
          // Check for placeholder row from checkout.session.completed
          const pending = await prisma.subscription.findFirst({
            where: { userEmail, stripeCustomerId: customerId },
            orderBy: { createdAt: "desc" },
          });

          if (pending) {
            await prisma.subscription.update({
              where: { id: pending.id },
              data: {
                stripeSubscriptionId: sub.id,
                priceId,
                status,
                currentPeriodEnd,
                cancelAtPeriodEnd,
              },
            });
          } else {
            await prisma.subscription.create({
              data: {
                userEmail,
                stripeCustomerId: customerId || "",
                stripeSubscriptionId: sub.id,
                priceId,
                status,
                currentPeriodEnd,
                cancelAtPeriodEnd,
              },
            });
          }
        }
        break;
      }

      default:
        break;
    }

    return NextResponse.json({ received: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Webhook handler failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
