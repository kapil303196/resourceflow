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

/**
 * IMPORTANT: cache the AsyncLocalStorage on globalThis. In Next.js dev mode
 * the module hot-reloads on every code change, which would otherwise create
 * a fresh storage instance. The Mongoose plugin (registered once on the
 * schema) holds a reference to whichever storage existed when the schema
 * was first created — so a fresh module-local storage means
 * `storage.get()` reads `undefined` from inside hooks, and `tenantId`
 * never gets stamped on `Model.create()`. Sharing one storage across
 * reloads keeps both sides in sync.
 */
declare global {
  // eslint-disable-next-line no-var
  var __tenantStorage: AsyncLocalStorage<TenantContext> | undefined;
}

const storage = (globalThis.__tenantStorage ??=
  new AsyncLocalStorage<TenantContext>());

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
