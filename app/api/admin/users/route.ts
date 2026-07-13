import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { OWNER_EMAIL } from "@/lib/constants";
import { logAudit } from "@/lib/audit";

const VALID_ROLES = ["user", "admin", "promoter"] as const;
type Role = (typeof VALID_ROLES)[number];

function getMeta(request: Request) {
  const ipHeader = request.headers.get("x-forwarded-for");
  const ip = ipHeader
    ? ipHeader.split(",")[0]?.trim()
    : request.headers.get("x-real-ip");
  const userAgent = request.headers.get("user-agent");
  return { ip, userAgent };
}

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  const user = session?.user as { email?: string | null; isAdmin?: boolean } | undefined;
  if (!user?.email || !user?.isAdmin) return null;
  return session;
}

export async function GET() {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [users, subscriptions] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: { email: true, role: true, createdAt: true, lastLoginAt: true },
    }),
    prisma.subscription.findMany({
      where: { status: { in: ["active", "trialing", "past_due"] } },
      select: { userEmail: true, status: true, currentPeriodEnd: true },
    }),
  ]);

  const subMap = new Map(subscriptions.map((s) => [s.userEmail, s]));

  const enriched = users.map((u) => {
    const sub = subMap.get(u.email);
    return {
      ...u,
      subscriptionStatus: sub?.status ?? null,
      subscriptionEnd: sub?.currentPeriodEnd?.toISOString() ?? null,
    };
  });

  return NextResponse.json({ users: enriched });
}

export async function PATCH(request: Request) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const actorEmail = (session.user?.email ?? "").toLowerCase();

  const body = await request.json().catch(() => null) as { email?: string; role?: string } | null;
  const email = body?.email?.toLowerCase?.();
  const role = body?.role;

  if (!email || !role || !VALID_ROLES.includes(role as Role)) {
    return NextResponse.json(
      { error: "Invalid request. Role must be: user, admin, or promoter" },
      { status: 400 }
    );
  }

  // Prevent changing your own role
  if (email === actorEmail) {
    return NextResponse.json({ error: "You cannot change your own role" }, { status: 403 });
  }

  // The owner's role cannot be changed by anyone
  const ownerEmail = (OWNER_EMAIL ?? "").toLowerCase();
  if (email === ownerEmail) {
    return NextResponse.json({ error: "Owner role cannot be changed" }, { status: 400 });
  }

  // Look up the target user's current role (404 if unknown email)
  const targetUser = await prisma.user.findUnique({
    where: { email },
    select: { role: true },
  });
  if (!targetUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const currentRole = targetUser.role;

  // Only the owner can promote TO admin OR demote FROM admin
  if ((role === "admin" || currentRole === "admin") && actorEmail !== ownerEmail) {
    return NextResponse.json(
      { error: "Only the owner can grant or revoke admin access" },
      { status: 403 }
    );
  }

  // Apply the role change
  const updated = await prisma.user.update({
    where: { email },
    data: { role: role as Role },
    select: { email: true, role: true, createdAt: true, lastLoginAt: true },
  });

  // Audit trail (non-fatal)
  const meta = getMeta(request);
  try {
    await logAudit({
      actorEmail,
      action: "role_change",
      targetEmail: email,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
  } catch {
    // Non-fatal
  }

  return NextResponse.json({ success: true, email, role, user: updated });
}
