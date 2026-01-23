import { prisma } from "@/lib/prisma";

export async function getEntitlementsByEmail(email: string) {
  const e = (email || "").trim().toLowerCase();
  if (!e) {
    return { isActiveSubscriber: false, subscriptionStatus: null, currentPeriodEnd: null };
  }

  const sub = await prisma.subscription.findFirst({
    where: { userEmail: e },
    orderBy: { updatedAt: "desc" },
  });

  if (!sub) {
    return { isActiveSubscriber: false, subscriptionStatus: null, currentPeriodEnd: null };
  }

  const now = Date.now();
  const endMs = sub.currentPeriodEnd ? sub.currentPeriodEnd.getTime() : 0;
  const isActiveStatus = sub.status === "active" || sub.status === "trialing";
  const hasTimeRemaining = endMs > now;

  return {
    isActiveSubscriber: Boolean(isActiveStatus && hasTimeRemaining),
    subscriptionStatus: sub.status ?? null,
    currentPeriodEnd: sub.currentPeriodEnd ? sub.currentPeriodEnd.toISOString() : null,
  };
}
