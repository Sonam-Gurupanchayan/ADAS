import NextAuth, { type DefaultSession } from "next-auth";
import { isAdminProfile } from "@/lib/oidc-claims";

declare module "next-auth" {
  interface Session {
    user: { id: string; isAdmin: boolean } & DefaultSession["user"];
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    isAdmin?: boolean;
  }
}

// OEM suppliers and admins sign in through the external OpenID Connect provider.
// Sensor users never use this — they have their own passkey session (see lib/sensor-session.ts).
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    {
      id: "oidc",
      name: process.env.OIDC_DISPLAY_NAME || "Single sign-on",
      type: "oidc",
      issuer: process.env.OIDC_ISSUER,
      clientId: process.env.OIDC_CLIENT_ID,
      clientSecret: process.env.OIDC_CLIENT_SECRET,
      authorization: { params: { scope: process.env.OIDC_SCOPES || "openid email profile" } },
      checks: ["pkce", "state", "nonce"],
    },
  ],
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 },
  pages: { signIn: "/portal/signin", error: "/portal/signin" },
  trustHost: true,
  callbacks: {
    async jwt({ token, profile }) {
      if (profile) {
        token.sub = String(profile.sub);
        token.email = (profile.email as string) ?? token.email;
        token.name = (profile.name as string) ?? (profile.preferred_username as string) ?? token.name;
        token.isAdmin = isAdminProfile(profile as Record<string, unknown>);
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.sub!;
      session.user.isAdmin = !!token.isAdmin;
      return session;
    },
  },
  events: {
    async signIn({ profile }) {
      if (!profile?.sub) return;
      // Imported lazily so this module stays usable from the proxy without pulling in CouchDB.
      const { upsertOemUserOnLogin } = await import("@/lib/repo/directory");
      const { logEventSoft } = await import("@/lib/audit");
      const email = String(profile.email ?? "");
      await upsertOemUserOnLogin({
        sub: String(profile.sub),
        email,
        name: String(profile.name ?? profile.preferred_username ?? email),
      });
      const admin = isAdminProfile(profile as Record<string, unknown>);
      await logEventSoft({ type: admin ? "admin" : "oem", id: `oem:${profile.sub}`, email }, "auth.login", {
        meta: { provider: "oidc" },
      });
    },
    async signOut(message) {
      const token = "token" in message ? message.token : null;
      if (!token?.sub) return;
      const { logEventSoft } = await import("@/lib/audit");
      await logEventSoft(
        { type: token.isAdmin ? "admin" : "oem", id: `oem:${token.sub}`, email: token.email ?? null },
        "auth.logout",
      );
    },
  },
});
