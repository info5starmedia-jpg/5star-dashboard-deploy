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
  // 1) customer_email (sometimes present)
  if (sub?.customer_email && typeof sub.customer_email === "string") return sub.customer_email;

  // 2) metadata we set
  if (sub?.metadata?.userEmail) return sub.metadata.userEmail;

  // 3) fetch customer by id and read email (if not deleted)
  const customerId =
    typeof sub?.customer === "string"
      ? sub.customer
      : sub?.customer?.id
        ? sub.customer.id
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

  // idempotency: store once
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
          session?.metadata?.userEmail ||
          session?.customer_details?.email ||
          null;

        const customerId =
          typeof session?.customer === "string"
            ? session.customer
            : session?.customer?.id || null;

        if (userEmail && customerId) {
          const existing = await prisma.subscription.findFirst({ where: { userEmail } });

          if (existing) {
            await prisma.subscription.update({
              where: { id: existing.id },
              data: { stripeCustomerId: customerId },
            });
          } else {
            await prisma.subscription.create({
              data: {
                userEmail,
                stripeCustomerId: customerId,
                stripeSubscriptionId: `pending_${Date.now()}`,
                priceId: process.env.STRIPE_PRICE_ID_MONTHLY || "",
                status: "pending",
              },
            });
          }
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
            : sub?.customer?.id || "";

        const priceId =
          sub.items?.data?.[0]?.price?.id ||
          process.env.STRIPE_PRICE_ID_MONTHLY ||
          "";

        const status = sub.status || "unknown";
        const cancelAtPeriodEnd = !!sub.cancel_at_period_end;

        // Some Stripe payloads use current_period_end (unix seconds). If missing, keep null.
        const cpe = sub.current_period_end;
        const currentPeriodEnd =
          typeof cpe === "number" ? new Date(cpe * 1000) : null;

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
          // try attach to pending row
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
