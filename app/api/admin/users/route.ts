import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { OWNER_EMAIL } from "@/lib/constants";
import { logAudit } from "@/lib/audit";

type Role = "user" | "admin";

function getMeta(request: Request) {
  const ipHeader = request.headers.get("x-forwarded-for");
  const ip = ipHeader ? ipHeader.split(",")[0]?.trim() : null;
  const userAgent = request.headers.get("user-agent");
  return { ip, userAgent };
}

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role;
  if (!session?.user?.email || role !== "admin") return null;
  return session;
}

export async function GET() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: { email: true, role: true, createdAt: true, lastLoginAt: true },
  });

  return NextResponse.json({ users });
}

export async function PATCH(request: Request) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null) as { email?: string; role?: Role } | null;
  const email = body?.email?.toLowerCase?.();
  const role = body?.role;

  if (!email || (role !== "user" && role !== "admin")) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  if (email === OWNER_EMAIL) {
    return NextResponse.json({ error: "Owner role cannot be changed" }, { status: 400 });
  }

  const updated = await prisma.user.update({
    where: { email },
    data: { role },
    select: { email: true, role: true, createdAt: true, lastLoginAt: true },
  });

  const meta = getMeta(request);
  await logAudit({
    actorEmail: session.user.email!,
    action: "role_change",
    targetEmail: email,
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  return NextResponse.json({ user: updated });
}
