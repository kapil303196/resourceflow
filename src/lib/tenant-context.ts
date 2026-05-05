import { AsyncLocalStorage } from "node:async_hooks";

export type TenantContext = {
  tenantId: string;
  userId: string;
  permissions: readonly string[];
  /**
   * When true, the auto-tenant filter is bypassed. Use only for system jobs
   * (cron/seed) and never inside request handlers.
   */
  systemBypass?: boolean;
};

const storage = new AsyncLocalStorage<TenantContext>();

export const tenantContext = {
  run<T>(ctx: TenantContext, fn: () => T): T {
    return storage.run(ctx, fn);
  },
  get(): TenantContext | undefined {
    return storage.getStore();
  },
  require(): TenantContext {
    const ctx = storage.getStore();
    if (!ctx) {
      throw new Error("Tenant context required but not present.");
    }
    return ctx;
  },
};
