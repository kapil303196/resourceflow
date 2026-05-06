import { AuditLog } from "@/models";
import { tenantContext } from "@/lib/tenant-context";

export async function recordAudit(opts: {
  action: string;
  entityType: string;
  entityId?: string;
  previousValue?: unknown;
  newValue?: unknown;
  ipAddress?: string;
  userAgent?: string;
}) {
  try {
    const ctx = tenantContext.get();
    await AuditLog.create({
      ...(ctx
        ? { tenantId: ctx.tenantId, createdBy: ctx.userId, updatedBy: ctx.userId, userId: ctx.userId }
        : {}),
      action: opts.action,
      entityType: opts.entityType,
      entityId: opts.entityId,
      previousValue: opts.previousValue,
      newValue: opts.newValue,
      ipAddress: opts.ipAddress,
      userAgent: opts.userAgent,
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[audit] failed to record audit log", e);
  }
}
