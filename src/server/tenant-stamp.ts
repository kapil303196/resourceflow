import { tenantContext } from "@/lib/tenant-context";

/**
 * Returns the tenantId / createdBy / updatedBy stamp to spread onto any
 * `Model.create()` payload. Bulletproof against the Mongoose hook not
 * firing (e.g. stale plugin closure across dev HMR) — we always pass the
 * value explicitly instead of trusting the hook.
 *
 * Must be called from within a protected tRPC resolver (i.e. inside the
 * tenantContext.run() scope). System / seed paths can call
 * `tenantStampSystem(tenantId, userId)` instead.
 */
export function tenantStamp() {
  const ctx = tenantContext.require();
  return {
    tenantId: ctx.tenantId,
    createdBy: ctx.userId,
    updatedBy: ctx.userId,
  } as const;
}

export function tenantStampSystem(tenantId: string, userId?: string) {
  return {
    tenantId,
    ...(userId ? { createdBy: userId, updatedBy: userId } : {}),
  } as const;
}
