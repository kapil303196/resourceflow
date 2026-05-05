import { AuditLog } from "@/models";

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
    await AuditLog.create({
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
