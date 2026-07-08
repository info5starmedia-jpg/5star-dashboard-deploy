import type { NextAuthOptions } from "next-auth";
import DiscordProvider from "next-auth/providers/discord";
import GoogleProvider from "next-auth/providers/google";
import { isAdminEmail } from "@/lib/isAdmin";
import { getEntitlementsByEmail } from "@/lib/entitlements";
import { prisma } from "@/lib/prisma";

function envClean(key: string): string {
  return (process.env[key] || "").replace(/^["']|["']$/g, "").trim();
}

type TokenFlags = {
  isAdmin?: boolean;
  isPromoter?: boolean;
  isSubscriber?: boolean;
  subscriptionStatus?: string | null;
  currentPeriodEnd?: Date | string | null;
};

export const authOptions: NextAuthOptions = {
  secret: envClean("NEXTAUTH_SECRET") || envClean("AUTH_SECRET"),
  session: { strategy: "jwt" },
  pages: { signIn: "/signin" },
  cookies: {
    state: {
      name: "next-auth.state",
      options: { httpOnly: true, sameSite: "lax", path: "/", secure: false },
    },
    pkceCodeVerifier: {
      name: "next-auth.pkce.code_verifier",
      options: { httpOnly: true, sameSite: "lax", path: "/", secure: false },
    },
  },

  providers: [
    DiscordProvider({
      clientId: envClean("DISCORD_CLIENT_ID"),
      clientSecret: envClean("DISCORD_CLIENT_SECRET"),
    }),
    GoogleProvider({
      clientId: envClean("GOOGLE_CLIENT_ID"),
      clientSecret: envClean("GOOGLE_CLIENT_SECRET"),
      authorization: {
        params: { prompt: "consent", access_type: "offline", response_type: "code" },
      },
    }),
  ],

  callbacks: {
    // Upsert user row on every sign-in so the User table stays populated
    async signIn({ user }) {
      if (!user?.email) return true;
      try {
        await prisma.user.upsert({
          where: { email: user.email.toLowerCase() },
          create: { email: user.email.toLowerCase() },
          update: { lastLoginAt: new Date() },
        });
      } catch {
        // best-effort — never block sign-in
      }
      return true;
    },

    async jwt({ token }) {
      const email = token?.email ? String(token.email) : "";
      const tokenFlags = token as typeof token & TokenFlags;

      if (email) {
        // Always read role from DB so changes take effect on next token refresh
        let dbRole: string | null = null;
        try {
          const dbUser = await prisma.user.findUnique({
            where: { email: email.toLowerCase() },
            select: { role: true },
          });
          dbRole = dbUser?.role ?? null;
        } catch {
          // best-effort — fall back to env-based check only
        }

        tokenFlags.isAdmin = isAdminEmail(email) || dbRole === "admin";
        tokenFlags.isPromoter = dbRole === "promoter";

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
        tokenFlags.isPromoter = false;
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
        user.isPromoter = !!tokenFlags.isPromoter;
        user.isSubscriber = !!tokenFlags.isSubscriber;
        user.subscriptionStatus = tokenFlags.subscriptionStatus ?? null;
        user.currentPeriodEnd = tokenFlags.currentPeriodEnd ?? null;
      }
      return session;
    },
  },
};
