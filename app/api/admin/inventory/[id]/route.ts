import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdminEmail } from "@/lib/isAdmin";
import { prisma } from "@/lib/prisma";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email || "";
  if (!email || !isAdminEmail(email)) return null;
  return { email };
}

export async function DELETE(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await ctx.params;
  await prisma.inventoryItem.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
