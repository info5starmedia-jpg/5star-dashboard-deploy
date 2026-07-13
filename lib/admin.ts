import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdminEmail } from "@/lib/isAdmin";

export async function requireAdminSession() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email || "";
  const sessionUser = session?.user as { isAdmin?: boolean } | undefined;
  // Allow if email is in env allowlist OR if JWT flagged them as admin (DB role)
  if (!email || (!isAdminEmail(email) && !sessionUser?.isAdmin)) return null;
  return session;
}
