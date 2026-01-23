import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdminEmail } from "@/lib/isAdmin";

export async function requireAdminSession() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email || "";
  if (!email || !isAdminEmail(email)) return null;
  return session;
}
