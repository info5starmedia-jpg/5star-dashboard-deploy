import { prisma } from "@/lib/prisma";

export async function logAudit(args: {
  actorEmail: string;
  action: string;
  targetEmail?: string | null;
  ip?: string | null;
  userAgent?: string | null;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        actorEmail: args.actorEmail,
        action: args.action,
        targetEmail: args.targetEmail ?? null,
        ip: args.ip ?? null,
        userAgent: args.userAgent ?? null,
      },
    });
  } catch {
    // best-effort audit
  }
}
