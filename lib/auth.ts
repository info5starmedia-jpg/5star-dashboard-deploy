import type { NextAuthOptions } from "next-auth";
import DiscordProvider from "next-auth/providers/discord";
import GoogleProvider from "next-auth/providers/google";
import { isAdminEmail } from "@/lib/isAdmin";
import { getEntitlementsByEmail } from "@/lib/entitlements";

const {
  DISCORD_CLIENT_ID,
  DISCORD_CLIENT_SECRET,
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  NEXTAUTH_SECRET,
  AUTH_SECRET,
} = process.env;

export const authOptions: NextAuthOptions = {
  secret: NEXTAUTH_SECRET || AUTH_SECRET,
  session: { strategy: "jwt" },
  pages: { signIn: "/signin" },

  providers: [
    DiscordProvider({
      clientId: DISCORD_CLIENT_ID || "",
      clientSecret: DISCORD_CLIENT_SECRET || "",
    }),
    GoogleProvider({
      clientId: GOOGLE_CLIENT_ID || "",
      clientSecret: GOOGLE_CLIENT_SECRET || "",
    }),
  ],

  callbacks: {
    async jwt({ token }) {
      const email = token?.email ? String(token.email) : "";
      if (email) {
        (token as any).isAdmin = isAdminEmail(email);

        try {
          const ent = await getEntitlementsByEmail(email);
          (token as any).isSubscriber = !!ent?.isActiveSubscriber;
          (token as any).subscriptionStatus = ent?.subscriptionStatus ?? null;
          (token as any).currentPeriodEnd = ent?.currentPeriodEnd ?? null;
        } catch {
          (token as any).isSubscriber = false;
          (token as any).subscriptionStatus = null;
          (token as any).currentPeriodEnd = null;
        }
      } else {
        (token as any).isAdmin = false;
        (token as any).isSubscriber = false;
        (token as any).subscriptionStatus = null;
        (token as any).currentPeriodEnd = null;
      }
      return token;
    },

    async session({ session, token }) {
      if (session?.user) {
        (session.user as any).isAdmin = !!(token as any).isAdmin;
        (session.user as any).isSubscriber = !!(token as any).isSubscriber;
        (session.user as any).subscriptionStatus =
          (token as any).subscriptionStatus ?? null;
        (session.user as any).currentPeriodEnd =
          (token as any).currentPeriodEnd ?? null;
      }
      return session;
    },
  },
};
