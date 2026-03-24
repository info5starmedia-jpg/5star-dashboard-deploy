import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/admin";
import { logAudit } from "@/lib/audit";

const ALLOWED_STATUSES = ["void", "cancelled"] as const;
type AllowedStatus = (typeof ALLOWED_STATUSES)[number];

function getMeta(request: Request) {
  const ipHeader = request.headers.get("x-forwarded-for");
  const ip = ipHeader ? ipHeader.split(",")[0]?.trim() : null;
  const userAgent = request.headers.get("user-agent");
  return { ip, userAgent };
}

export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await requireAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;

  const body = await request.json().catch(() => null) as { status?: string } | null;
  const newStatus = body?.status as AllowedStatus | undefined;

  if (!newStatus || !ALLOWED_STATUSES.includes(newStatus)) {
    return NextResponse.json(
      { error: `status must be one of: ${ALLOWED_STATUSES.join(", ")}` },
      { status: 400 }
    );
  }

  const invoice = await prisma.invoice.findUnique({ where: { id } });
  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  if (invoice.status !== "issued") {
    return NextResponse.json(
      { error: `Invoice is already ${invoice.status} and cannot be changed` },
      { status: 409 }
    );
  }

  const updated = await prisma.invoice.update({
    where: { id },
    data: { status: newStatus },
    include: { lineItems: true },
  });

  const meta = getMeta(request);
  await logAudit({
    actorEmail: session.user!.email!,
    action: `invoice_${newStatus}`,
    targetEmail: invoice.customerEmail ?? undefined,
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  return NextResponse.json({ invoice: updated });
}
