import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/admin";
import { logAudit } from "@/lib/audit";
import { generateInvoicePdf } from "@/lib/pdf";
import { sendInvoiceEmail } from "@/lib/email";

function getMeta(request: Request) {
  const ipHeader = request.headers.get("x-forwarded-for");
  const ip = ipHeader ? ipHeader.split(",")[0]?.trim() : null;
  const userAgent = request.headers.get("user-agent");
  return { ip, userAgent };
}

type InvoiceItemInput = { description?: string; sku?: string | null; quantity?: number; unitPriceCents?: number };

export async function GET() {
  const session = await requireAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const invoices = await prisma.invoice.findMany({ orderBy: { createdAt: "desc" }, include: { lineItems: true } });
  return NextResponse.json({ invoices });
}

export async function POST(request: Request) {
  const session = await requireAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { customerEmail?: string | null; taxCents?: number; items?: InvoiceItemInput[]; sendEmail?: boolean } | null;

  const items = Array.isArray(body?.items) ? body?.items : [];
  const normalized = items.map((item) => ({
    description: String(item?.description || "").trim(),
    sku: item?.sku ? String(item.sku).trim() : "",
    quantity: Number(item?.quantity ?? 0),
    unitPriceCents: Number(item?.unitPriceCents ?? 0),
  })).filter((item) => item.description && Number.isFinite(item.quantity) && item.quantity > 0 && Number.isFinite(item.unitPriceCents) && item.unitPriceCents >= 0);

  if (normalized.length === 0) return NextResponse.json({ error: "At least one line item is required" }, { status: 400 });

  const taxCents = Number(body?.taxCents ?? 0);
  if (!Number.isFinite(taxCents) || taxCents < 0) return NextResponse.json({ error: "Invalid taxCents" }, { status: 400 });

  const subtotalCents = normalized.reduce((sum, item) => sum + item.quantity * item.unitPriceCents, 0);
  const totalCents = subtotalCents + taxCents;
  const customerEmail = body?.customerEmail ? String(body.customerEmail).trim() : null;

  try {
    const invoice = await prisma.$transaction(async (tx) => {
      for (const item of normalized) {
        if (!item.sku) continue;
        const inventory = await tx.inventoryItem.findUnique({ where: { sku: item.sku } });
        if (inventory && inventory.quantity < item.quantity) throw new Error(`Insufficient inventory for SKU ${item.sku}`);
      }
      const created = await tx.invoice.create({
        data: {
          createdByEmail: session.user.email || "",
          customerEmail,
          subtotalCents,
          taxCents,
          totalCents,
          lineItems: { create: normalized.map((item) => ({ description: item.description, sku: item.sku || null, quantity: item.quantity, unitPriceCents: item.unitPriceCents, totalCents: item.quantity * item.unitPriceCents })) },
        },
        include: { lineItems: true },
      });
      for (const item of normalized) {
        if (!item.sku) continue;
        const inventory = await tx.inventoryItem.findUnique({ where: { sku: item.sku } });
        if (!inventory) continue;
        await tx.inventoryItem.update({ where: { sku: item.sku }, data: { quantity: { decrement: item.quantity } } });
      }
      return created;
    });

    const meta = getMeta(request);
    await logAudit({ actorEmail: session.user.email || "", action: "invoice_create", targetEmail: invoice.customerEmail ?? undefined, ip: meta.ip, userAgent: meta.userAgent });

    let emailSent = false;
    let emailError: string | null = null;
    if (body?.sendEmail !== false && customerEmail) {
      try {
        const pdfBuffer = generateInvoicePdf({ id: invoice.id, createdAt: invoice.createdAt, createdByEmail: invoice.createdByEmail, customerEmail: invoice.customerEmail, subtotalCents: invoice.subtotalCents, taxCents: invoice.taxCents, totalCents: invoice.totalCents, lineItems: invoice.lineItems });
        const result = await sendInvoiceEmail({ to: customerEmail, invoiceId: invoice.id, pdfBuffer });
        emailSent = result.ok;
        emailError = result.error ?? null;
      } catch (err) { emailError = err instanceof Error ? err.message : "unknown"; }
    }

    return NextResponse.json({ invoice, email: { sent: emailSent, error: emailError } });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Insufficient inventory")) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ error: "Failed to create invoice" }, { status: 500 });
  }
}
