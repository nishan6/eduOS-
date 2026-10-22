import "server-only";
import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { twoFactor } from "better-auth/plugins";
import { prisma } from "@/lib/db";
import { getEmailProvider } from "@/lib/integrations/email";

const signInMax = Number(process.env.EDUOS_SIGNIN_RATE_MAX ?? 10);

export const auth = betterAuth({
  appName: "EduOS",
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: {
    enabled: true,
    // No public registration: accounts are created by invitation or by administrators.
    disableSignUp: true,
    minPasswordLength: 10,
    revokeSessionsOnPasswordReset: true,
    async sendResetPassword({ user, url }) {
      await getEmailProvider().send({
        to: user.email,
        subject: "Reset your EduOS password",
        body: `Use this link to reset your password. It expires in one hour.\n\n${url}`,
      });
    },
  },
  session: {
    expiresIn: 60 * 60 * 12, // 12 hours
    updateAge: 60 * 60,
  },
  rateLimit: {
    enabled: true,
    storage: "database",
    window: 60,
    max: 200,
    customRules: {
      "/sign-in/email": { window: 60, max: signInMax },
      "/request-password-reset": { window: 300, max: 3 },
      "/two-factor/*": { window: 60, max: 10 },
    },
  },
  databaseHooks: {
    session: {
      create: {
        async before(session) {
          const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { status: true } });
          if (!user || user.status !== "ACTIVE") {
            throw new APIError("FORBIDDEN", { message: "This account is not active. Contact your school administrator." });
          }
          return { data: session };
        },
      },
    },
  },
  plugins: [twoFactor({ issuer: "EduOS" }), nextCookies()],
});
