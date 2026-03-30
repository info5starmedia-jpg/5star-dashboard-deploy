import { NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";

export const runtime = "nodejs";

type SubscriptionPayload = Stripe.Subscription & {
  customer_email?: string | null;
  current_period_end?: number | null;
};

async function getRawBody(request: Request) {
  return await request.text();
}

function getSignature(request: Request) {
  return request.headers.get("stripe-signature") || "";
}

async function resolveUserEmailFromSubscription(sub: SubscriptionPayload): Promise<string | null> {
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

        if (!userEmail || !customerId) break;

        // Fetch the real subscription from Stripe so we activate immediately
        // instead of leaving status as "pending".
        let status = "active";
        let priceId = process.env.STRIPE_PRICE_ID_MONTHLY || "";
        let currentPeriodEnd: Date | null = null;
        let cancelAtPeriodEnd = false;

        if (subscriptionId) {
          try {
            const sub = await stripe.subscriptions.retrieve(subscriptionId);
            status = sub.status;
            priceId = sub.items?.data?.[0]?.price?.id || priceId;
            const periodEnd = (sub as unknown as Record<string, unknown>).current_period_end as number | null;
            currentPeriodEnd = periodEnd ? new Date(periodEnd * 1000) : null;
            cancelAtPeriodEnd = !!(sub as unknown as Record<string, unknown>).cancel_at_period_end;
          } catch {
            // Could not retrieve sub — fall back to "active" defaults
          }
        }

        // Find existing row by userEmail or subscriptionId (handles race with
        // customer.subscription.created arriving before this event)
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
        const sub = event.data.object as SubscriptionPayload;
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
        const subAny = sub as unknown as Record<string, unknown>;
        const cancelAtPeriodEnd = !!subAny.cancel_at_period_end;
        const cpe = subAny.current_period_end as number | undefined;
        const currentPeriodEnd = typeof cpe === "number" ? new Date(cpe * 1000) : null;

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
