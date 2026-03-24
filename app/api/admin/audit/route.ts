import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  const user = session?.user as { email?: string | null; isAdmin?: boolean } | undefined;
  if (!user?.email || !user?.isAdmin) return null;
  return session;
}

export async function GET() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json({ logs });
}
