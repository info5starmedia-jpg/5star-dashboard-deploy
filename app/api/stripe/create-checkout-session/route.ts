import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { getPriceIdForPlan, type PlanSlug } from "@/lib/constants";

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return fallback;
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const email = session?.user?.email;

    if (!email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const planSlug = typeof body?.planSlug === "string" ? (body.planSlug as PlanSlug) : null;

    // planSlug present (from /dashboard) -> charge that plan's own price.
    // No planSlug (from /billing's generic "Subscribe Now") -> keep the
    // original single default-plan behavior.
    let priceId = process.env.STRIPE_PRICE_ID_MONTHLY;
    if (planSlug) {
      const planPriceId = getPriceIdForPlan(planSlug);
      if (!planPriceId) {
        return NextResponse.json(
          { error: `No Stripe price configured for plan "${planSlug}"` },
          { status: 500 }
        );
      }
      priceId = planPriceId;
    }

    if (!priceId) {
      return NextResponse.json(
        { error: "Missing STRIPE_PRICE_ID_MONTHLY" },
        { status: 500 }
      );
    }

    // Ensure stripe customer exists for this user
    let sub = await prisma.subscription.findFirst({ where: { userEmail: email } });

    let stripeCustomerId = sub?.stripeCustomerId;
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email,
        metadata: { userEmail: email },
      });
      stripeCustomerId = customer.id;

      // Create a placeholder subscription row if none exists yet
      if (!sub) {
        sub = await prisma.subscription.create({
          data: {
            userEmail: email,
            stripeCustomerId,
            stripeSubscriptionId: `pending_${Date.now()}`, // will be updated by webhook
            priceId,
            status: "pending",
          },
        });
      } else {
        await prisma.subscription.update({
          where: { id: sub.id },
          data: { stripeCustomerId },
        });
      }
    }

    const baseUrl =
      process.env.NEXTAUTH_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      "http://localhost:3000";

    const checkout = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: stripeCustomerId,
      line_items: [{ price: priceId, quantity: 1 }],
      allow_promotion_codes: true,
      success_url: `${baseUrl}/dashboard?checkout=success`,
      cancel_url: `${baseUrl}/billing?checkout=cancel`,
      metadata: { userEmail: email, planSlug: planSlug ?? "" },
    });

    return NextResponse.json({ url: checkout.url });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: getErrorMessage(error, "Checkout session failed") },
      { status: 500 }
    );
  }
}
