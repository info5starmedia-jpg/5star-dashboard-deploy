import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userEmail = session.user.email;

  const body = await request.json().catch(() => null) as {
    sku?: string;
    quantity?: number;
  } | null;

  const sku = body?.sku?.trim();
  const quantity = Math.floor(Number(body?.quantity ?? 0));

  if (!sku) {
    return NextResponse.json({ error: "SKU is required" }, { status: 400 });
  }
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return NextResponse.json({ error: "Quantity must be a positive integer" }, { status: 400 });
  }

  // Verify item exists and has enough stock before sending to Stripe
  const item = await prisma.inventoryItem.findUnique({ where: { sku } });

  if (!item) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }
  if (item.quantity < quantity) {
    return NextResponse.json(
      {
        error: `Only ${item.quantity} unit${item.quantity !== 1 ? "s" : ""} available — you requested ${quantity}`,
      },
      { status: 400 }
    );
  }

  const baseUrl =
    process.env.NEXTAUTH_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000";

  try {
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: userEmail,
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: item.priceCents,
            product_data: {
              name: item.name,
              description: `SKU: ${item.sku}`,
            },
          },
          quantity,
        },
      ],
      // Lets customers enter promo/coupon codes you create in Stripe dashboard
      allow_promotion_codes: true,
      success_url: `${baseUrl}/dashboard?purchase=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/dashboard?purchase=cancelled`,
      metadata: {
        type: "product_purchase",
        userEmail,
        sku: item.sku,
        quantity: String(quantity),
        itemName: item.name,
        unitPriceCents: String(item.priceCents),
      },
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Checkout session creation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
