import "server-only";
import { prisma } from "@/lib/db";

/**
 * Email adapter boundary. With no EMAIL_PROVIDER configured, messages are written to the
 * development outbox table (visible at /app/settings/outbox) and are NOT delivered.
 */
export type EmailMessage = { to: string; subject: string; body: string };

export interface EmailProvider {
  readonly name: string;
  send(message: EmailMessage): Promise<{ delivered: boolean; providerMessageId?: string }>;
}

const devOutbox: EmailProvider = {
  name: "development-outbox",
  async send(message) {
    await prisma.devOutboxMessage.create({ data: { channel: "email", to: message.to, subject: message.subject, body: message.body } });
    return { delivered: false };
  },
};

export function getEmailProvider(): EmailProvider {
  const configured = process.env.EMAIL_PROVIDER;
  if (!configured) return devOutbox;
  // Real providers (SES, Postmark, etc.) plug in here. Refuse to silently fall back in production.
  throw new Error(`Email provider "${configured}" is not implemented yet. Unset EMAIL_PROVIDER to use the development outbox.`);
}
