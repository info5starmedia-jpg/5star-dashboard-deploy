import type { NextAuthOptions } from "next-auth";
import DiscordProvider from "next-auth/providers/discord";
import GoogleProvider from "next-auth/providers/google";
import { isAdminEmail } from "@/lib/isAdmin";
import { getEntitlementsByEmail } from "@/lib/entitlements";

function envClean(key: string): string {
  return (process.env[key] || "").replace(/^["']|["']$/g, "").trim();
}

type TokenFlags = {
  isAdmin?: boolean;
  isSubscriber?: boolean;
  subscriptionStatus?: string | null;
  currentPeriodEnd?: Date | string | null;
};

export const authOptions: NextAuthOptions = {
  secret: envClean("NEXTAUTH_SECRET") || envClean("AUTH_SECRET"),
  session: { strategy: "jwt" },
  pages: { signIn: "/signin" },

  providers: [
    DiscordProvider({
      clientId: envClean("DISCORD_CLIENT_ID"),
      clientSecret: envClean("DISCORD_CLIENT_SECRET"),
    }),
    GoogleProvider({
      clientId: envClean("GOOGLE_CLIENT_ID"),
      clientSecret: envClean("GOOGLE_CLIENT_SECRET"),
    }),
  ],

  callbacks: {
    async jwt({ token }) {
      const email = token?.email ? String(token.email) : "";
      const tokenFlags = token as typeof token & TokenFlags;
      if (email) {
        tokenFlags.isAdmin = isAdminEmail(email);

        try {
          const ent = await getEntitlementsByEmail(email);
          tokenFlags.isSubscriber = !!ent?.isActiveSubscriber;
          tokenFlags.subscriptionStatus = ent?.subscriptionStatus ?? null;
          tokenFlags.currentPeriodEnd = ent?.currentPeriodEnd ?? null;
        } catch {
          tokenFlags.isSubscriber = false;
          tokenFlags.subscriptionStatus = null;
          tokenFlags.currentPeriodEnd = null;
        }
      } else {
        tokenFlags.isAdmin = false;
        tokenFlags.isSubscriber = false;
        tokenFlags.subscriptionStatus = null;
        tokenFlags.currentPeriodEnd = null;
      }
      return token;
    },

    async session({ session, token }) {
      if (session?.user) {
        const user = session.user as typeof session.user & TokenFlags;
        const tokenFlags = token as typeof token & TokenFlags;
        user.isAdmin = !!tokenFlags.isAdmin;
        user.isSubscriber = !!tokenFlags.isSubscriber;
        user.subscriptionStatus = tokenFlags.subscriptionStatus ?? null;
        user.currentPeriodEnd = tokenFlags.currentPeriodEnd ?? null;
      }
      return session;
    },
  },
};
