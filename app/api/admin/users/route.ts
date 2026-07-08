import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { OWNER_EMAIL } from "@/lib/constants";
import { logAudit } from "@/lib/audit";

const VALID_ROLES = ["user", "admin", "promoter"] as const;
type Role = (typeof VALID_ROLES)[number];

export async function GET() {
  const session = await requireAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [users, subscriptions] = await Promise.all([
    prisma.user.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.subscription.findMany({
      where: { status: { in: ["active", "trialing", "past_due"] } },
    }),
  ]);

  const subMap = new Map(subscriptions.map((s) => [s.userEmail, s]));

  return NextResponse.json(
    users.map((u) => {
      const sub = subMap.get(u.email);
      return {
        email: u.email,
        role: u.role,
        createdAt: u.createdAt,
        lastLoginAt: u.lastLoginAt,
        subscriptionStatus: sub?.status ?? null,
        subscriptionEnd: sub?.currentPeriodEnd ?? null,
      };
    })
  );
}

export async function PATCH(req: NextRequest) {
  const session = await requireAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const actorEmail = (session.user?.email ?? "").toLowerCase();
  const body = await req.json();
  const email: string = (body.email ?? "").toLowerCase();
  const role: string = body.role ?? "";

  if (!email || !VALID_ROLES.includes(role as Role)) {
    return NextResponse.json(
      { error: "Invalid request. Role must be: user, admin, or promoter" },
      { status: 400 }
    );
  }

  // Prevent changing your own role
  if (email === actorEmail) {
    return NextResponse.json({ error: "You cannot change your own role" }, { status: 403 });
  }

  // Look up the target user's current role
  const targetUser = await prisma.user.findUnique({
    where: { email },
    select: { role: true },
  });
  if (!targetUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const currentRole = targetUser.role;

  // Only the owner can promote TO admin OR demote FROM admin
  const ownerEmail = (OWNER_EMAIL ?? "").toLowerCase();
  if ((role === "admin" || currentRole === "admin") && actorEmail !== ownerEmail) {
    return NextResponse.json(
      { error: "Only the owner can grant or revoke admin access" },
      { status: 403 }
    );
  }

  // Apply the role change
  await prisma.user.update({ where: { email }, data: { role } });

  // Audit trail
  try {
    await logAudit({
      actorEmail,
      action: "role_change",
      targetEmail: email,
      ip: req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? "",
      userAgent: req.headers.get("user-agent") ?? "",
    });
  } catch {
    // Non-fatal
  }

  return NextResponse.json({ success: true, email, role });
}
