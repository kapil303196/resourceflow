import { Counter } from "@/models/counter";
import { tenantContext } from "@/lib/tenant-context";

/**
 * Format definitions per entity. `base` is the starting offset so the
 * first generated number is `base + 1` (formatted with the prefix).
 *
 * Numbers are unique per tenant per key — keys live on the Counter
 * collection scoped by tenantId via the base plugin.
 */
const FORMATS: Record<string, { prefix: string; base: number; pad?: number }> = {
  TRIP: { prefix: "T-", base: 100000, pad: 6 },
  PO: { prefix: "PO-", base: 30000, pad: 5 },
  SO: { prefix: "SO-", base: 10000, pad: 5 },
  INVOICE: { prefix: "INV-", base: 20000, pad: 5 },
  SLIP: { prefix: "SLIP-", base: 70000, pad: 5 },
  EXTRACTION: { prefix: "E-", base: 50000, pad: 5 },
};

/**
 * Atomically reserve and return the next human-readable number for the
 * given counter key. Uses MongoDB's atomic $inc with upsert so concurrent
 * creates never collide.
 */
export async function nextNumber(key: keyof typeof FORMATS): Promise<string> {
  const fmt = FORMATS[key];
  if (!fmt) throw new Error(`Unknown counter key: ${String(key)}`);
  const ctx = tenantContext.require();

  const doc: any = await Counter.findOneAndUpdate(
    { tenantId: ctx.tenantId, key },
    { $inc: { value: 1 } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).lean();

  const seq = (fmt.base + (doc?.value ?? 1)).toString().padStart(fmt.pad ?? 0, "0");
  return `${fmt.prefix}${seq}`;
}

export type CounterKey = keyof typeof FORMATS;
