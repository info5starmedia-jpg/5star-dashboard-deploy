import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/admin";
import { generateInvoicePdf } from "@/lib/pdf";

export const runtime = "nodejs";

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: { lineItems: true },
  });

  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  const lineItems = invoice.lineItems.map(
    (item: {
      description: string;
      sku: string | null;
      quantity: number;
      unitPriceCents: number;
      totalCents: number;
    }) => ({
      description: item.description,
      sku: item.sku,
      quantity: item.quantity,
      unitPriceCents: item.unitPriceCents,
      totalCents: item.totalCents,
    })
  );

  const pdf = generateInvoicePdf({
    id: invoice.id,
    createdAt: invoice.createdAt,
    createdByEmail: invoice.createdByEmail,
    customerEmail: invoice.customerEmail,
    subtotalCents: invoice.subtotalCents,
    taxCents: invoice.taxCents,
    totalCents: invoice.totalCents,
    lineItems,
  });

  return new Response(Buffer.from(pdf) as unknown as BodyInit, {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename=invoice_${invoice.id}.pdf`,
    },
  });
}
