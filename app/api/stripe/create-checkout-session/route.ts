import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";

export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    const email = session?.user?.email;

    if (!email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
            priceId: process.env.STRIPE_PRICE_ID_MONTHLY || "",
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

    const priceId = process.env.STRIPE_PRICE_ID_MONTHLY;
    if (!priceId) {
      return NextResponse.json(
        { error: "Missing STRIPE_PRICE_ID_MONTHLY" },
        { status: 500 }
      );
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
      metadata: { userEmail: email },
    });

    return NextResponse.json({ url: checkout.url });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Checkout session failed" },
      { status: 500 }
    );
  }
}
