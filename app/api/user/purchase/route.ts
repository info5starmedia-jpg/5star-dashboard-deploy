import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { sendDiscordAlert } from "@/lib/alerts";
import { logAudit } from "@/lib/audit";

// Admin-only for now: this creates an "issued" invoice and decrements stock
// with NO payment collected. It predates the Stripe product-purchase flow
// (see the webhook's `product_purchase` handling, which fulfills only after
// Stripe confirms payment) and was never wired to a customer-facing button.
// Left in as an admin tool for manual/comp orders; do not open this to
// regular users without putting a real payment step in front of it.
function getMeta(request: Request) {
  return {
    ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    userAgent: request.headers.get("user-agent"),
  };
}

function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

export async function POST(request: Request) {
  const session = await requireAdminSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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

  try {
    const order = await prisma.$transaction(async (tx) => {
      // Lock the item and verify stock
      const item = await tx.inventoryItem.findUnique({ where: { sku } });

      if (!item) {
        throw new Error(`Product not found: ${sku}`);
      }
      if (item.quantity < quantity) {
        throw new Error(
          `Only ${item.quantity} unit${item.quantity !== 1 ? "s" : ""} available — you requested ${quantity}`
        );
      }

      const unitPriceCents = item.priceCents;
      const totalCents = unitPriceCents * quantity;

      // Decrement stock
      await tx.inventoryItem.update({
        where: { sku },
        data: { quantity: { decrement: quantity } },
      });

      // Create invoice under customer's email
      const invoice = await tx.invoice.create({
        data: {
          createdByEmail: userEmail, // self-purchase
          customerEmail: userEmail,
          subtotalCents: totalCents,
          taxCents: 0,
          totalCents,
          status: "issued",
          lineItems: {
            create: [
              {
                description: item.name,
                sku: item.sku,
                quantity,
                unitPriceCents,
                totalCents,
              },
            ],
          },
        },
        include: { lineItems: true },
      });

      return { invoice, item };
    });

    // Audit log
    const meta = getMeta(request);
    await logAudit({
      actorEmail: userEmail,
      action: "user_purchase",
      targetEmail: userEmail,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    // Discord alert to owner
    const total = formatMoney(order.invoice.totalCents);
    await sendDiscordAlert(
      `🛒 New order from **${userEmail}**\n` +
        `• ${quantity}× ${order.item.name} (${order.item.sku})\n` +
        `• Total: ${total}\n` +
        `• Stock remaining: ${order.item.quantity - quantity}`
    );

    return NextResponse.json({ order: order.invoice }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Purchase failed";
    // Stock errors are user-facing (400), everything else is server (500)
    const isUserError =
      message.includes("Only") ||
      message.includes("not found") ||
      message.includes("Quantity");
    return NextResponse.json({ error: message }, { status: isUserError ? 400 : 500 });
  }
}
