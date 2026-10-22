import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma, type Tx } from "@/lib/db";

export type AuditEvent = {
  actorUserId: string | null;
  organizationId?: string | null;
  schoolId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  summary: string;
  /** Never put secrets or full personal records here; ids and changed field names only. */
  metadata?: Prisma.InputJsonValue;
};

export async function audit(event: AuditEvent, tx: Tx | typeof prisma = prisma) {
  await tx.auditLog.create({
    data: {
      actorUserId: event.actorUserId,
      organizationId: event.organizationId ?? null,
      schoolId: event.schoolId ?? null,
      action: event.action,
      entityType: event.entityType,
      entityId: event.entityId ?? null,
      summary: event.summary,
      metadata: event.metadata,
    },
  });
}
