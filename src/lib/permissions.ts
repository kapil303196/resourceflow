/**
 * Permission constants. Pattern: <module>.<action>
 * Roles are bundles of these strings.
 */

export const MODULES = [
  "tenant",
  "user",
  "role",
  "auditLog",
  "materialGrade",
  "location",
  "refinery",
  "license",
  "extraction",
  "supplier",
  "purchase",
  "refineryBatch",
  "inventory",
  "customer",
  "salesOrder",
  "invoice",
  "payment",
  "contractor",
  "vehicle",
  "maintenance",
  "driver",
  "attendance",
  "salary",
  "incident",
  "trip",
  "loadingSlip",
  "document",
  "report",
  "alert",
  "settings",
] as const;

export const ACTIONS = ["read", "create", "update", "delete", "export"] as const;

export type Module = (typeof MODULES)[number];
export type Action = (typeof ACTIONS)[number];
export type Permission = `${Module}.${Action}` | "*";

export function permission(m: Module, a: Action): Permission {
  return `${m}.${a}` as Permission;
}

export const ALL_PERMISSIONS: Permission[] = (() => {
  const list: Permission[] = ["*"];
  for (const m of MODULES) for (const a of ACTIONS) list.push(`${m}.${a}` as Permission);
  return list;
})();

/** Built-in role templates used by onboarding/seed. */
export const ROLE_TEMPLATES = {
  Owner: {
    description: "Full access to everything",
    permissions: ["*"] as Permission[],
  },
  Manager: {
    description: "All operations except user/role/tenant management",
    permissions: ALL_PERMISSIONS.filter(
      (p) =>
        p !== "*" &&
        !p.startsWith("user.") &&
        !p.startsWith("role.") &&
        !p.startsWith("tenant.") &&
        !p.startsWith("settings.") &&
        p !== "auditLog.delete",
    ),
  },
  Operator: {
    description: "Operational data entry — extractions, trips, deliveries, slips",
    permissions: [
      "extraction.read",
      "extraction.create",
      "extraction.update",
      "trip.read",
      "trip.create",
      "trip.update",
      "loadingSlip.read",
      "loadingSlip.create",
      "loadingSlip.update",
      "purchase.read",
      "purchase.create",
      "purchase.update",
      "refineryBatch.read",
      "refineryBatch.create",
      "refineryBatch.update",
      "inventory.read",
      "salesOrder.read",
      "customer.read",
      "vehicle.read",
      "driver.read",
      "license.read",
      "materialGrade.read",
      "location.read",
      "refinery.read",
      "document.read",
      "document.create",
      "report.read",
    ] as Permission[],
  },
  Viewer: {
    description: "Read-only access",
    permissions: ALL_PERMISSIONS.filter((p) => p.endsWith(".read")),
  },
} satisfies Record<string, { description: string; permissions: Permission[] }>;

export function hasPermission(
  granted: readonly string[] | undefined | null,
  required: Permission,
): boolean {
  if (!granted || granted.length === 0) return false;
  if (granted.includes("*")) return true;
  return granted.includes(required);
}

export function hasAnyPermission(
  granted: readonly string[] | undefined | null,
  required: readonly Permission[],
): boolean {
  if (!granted || granted.length === 0) return false;
  if (granted.includes("*")) return true;
  return required.some((p) => granted.includes(p));
}
