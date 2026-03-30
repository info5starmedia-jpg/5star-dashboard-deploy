import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      email?: string | null;
      role?: "user" | "admin";
      isAdmin?: boolean;
      isSubscriber?: boolean;
      subscriptionStatus?: string | null;
      currentPeriodEnd?: string | null;
    };
  }
}
