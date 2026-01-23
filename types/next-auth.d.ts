import "next-auth";

declare module "next-auth" {
  interface Session {
    user?: {
      name?: string | null;
      email?: string | null;
      image?: string | null;
      isAdmin?: boolean;
      isSubscriber?: boolean;
      subscriptionStatus?: string | null;
      currentPeriodEnd?: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    isAdmin?: boolean;
    isSubscriber?: boolean;
    subscriptionStatus?: string | null;
    currentPeriodEnd?: string | null;
  }
}
