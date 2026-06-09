import "server-only";
import { prisma } from "./db";

/** Append an immutable audit-trail entry. Never throws into the request path. */
export async function audit(params: {
  entityType: string;
  entityId: string;
  action: string;
  detail?: string;
  performedById?: string | null;
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        entityType: params.entityType,
        entityId: params.entityId,
        action: params.action,
        detail: params.detail,
        performedById: params.performedById ?? null,
      },
    });
  } catch (err) {
    console.error("audit log failed", err);
  }
}
