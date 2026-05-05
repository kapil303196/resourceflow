/**
 * Scheduled jobs runner. Run via `npm run jobs` (or wire up node-cron in
 * production). Each job is idempotent and uses dedupe keys to avoid
 * spamming alerts.
 */
import "dotenv/config";
import path from "node:path";
import { config as loadEnv } from "dotenv";
loadEnv({ path: path.resolve(process.cwd(), ".env.local") });

import { connectMongo, mongoose } from "../src/lib/mongo";
import { tenantContext } from "../src/lib/tenant-context";
import {
  Tenant,
  License,
  Vehicle,
  Driver,
  Document_,
  Invoice,
  VehicleMaintenance,
  Contractor,
  Alert,
  AlertRule,
} from "../src/models";

async function runForTenant(tenantId: string) {
  return tenantContext.run(
    { tenantId, userId: "system", permissions: ["*"] },
    async () => {
      const rules: any[] = await AlertRule.find({ isEnabled: true }).lean();
      const ruleByType = Object.fromEntries(rules.map((r) => [r.alertType, r]));
      const now = new Date();

      async function emit(opts: {
        alertType: string;
        severity: "INFO" | "WARNING" | "CRITICAL";
        title: string;
        body?: string;
        entityType?: string;
        entityId?: any;
        actionUrl?: string;
        dedupeKey: string;
      }) {
        if (!ruleByType[opts.alertType]) return;
        const existing = await Alert.findOne({ dedupeKey: opts.dedupeKey });
        if (existing) return;
        await Alert.create({ ...opts });
      }

      // 1. License expiring within threshold
      for (const l of await License.find({ status: "ACTIVE" })) {
        const rule = ruleByType.LICENSE_EXPIRY;
        if (!rule) continue;
        const days = Math.ceil(
          (new Date(l.validTo).getTime() - now.getTime()) / 86_400_000,
        );
        if (days <= rule.thresholdValue && days >= 0) {
          await emit({
            alertType: "LICENSE_EXPIRY",
            severity: days <= 7 ? "CRITICAL" : "WARNING",
            title: `License ${l.licenseNumber} expires in ${days} day(s)`,
            entityType: "License",
            entityId: l._id,
            actionUrl: `/licenses/${l._id}`,
            dedupeKey: `LICENSE_EXPIRY:${l._id}:${Math.floor(days / 7)}`,
          });
        }
      }

      // 2. Vehicle doc expiring
      const vRule = ruleByType.VEHICLE_DOC_EXPIRY;
      if (vRule) {
        const cutoff = new Date(now.getTime() + vRule.thresholdValue * 86_400_000);
        for (const v of await Vehicle.find({
          isActive: true,
          $or: [
            { insuranceExpiryDate: { $gte: now, $lte: cutoff } },
            { fitnessExpiryDate: { $gte: now, $lte: cutoff } },
            { permitExpiryDate: { $gte: now, $lte: cutoff } },
            { pucExpiryDate: { $gte: now, $lte: cutoff } },
          ],
        })) {
          await emit({
            alertType: "VEHICLE_DOC_EXPIRY",
            severity: "WARNING",
            title: `Vehicle ${v.registrationNumber}: a document is expiring soon`,
            entityType: "Vehicle",
            entityId: v._id,
            actionUrl: `/fleet/${v._id}`,
            dedupeKey: `VEHICLE_DOC:${v._id}`,
          });
        }
      }

      // 3. Driver license expiring
      const dRule = ruleByType.DRIVER_LICENSE_EXPIRY;
      if (dRule) {
        const cutoff = new Date(now.getTime() + dRule.thresholdValue * 86_400_000);
        for (const d of await Driver.find({
          isActive: true,
          licenseExpiryDate: { $gte: now, $lte: cutoff },
        })) {
          await emit({
            alertType: "DRIVER_LICENSE_EXPIRY",
            severity: "WARNING",
            title: `Driver ${d.name}: license expiring soon`,
            entityType: "Driver",
            entityId: d._id,
            dedupeKey: `DRIVER_LICENSE:${d._id}`,
          });
        }
      }

      // 4. Invoice OVERDUE status update + alert
      const oRule = ruleByType.OVERDUE_INVOICE;
      if (oRule) {
        await Invoice.updateMany(
          {
            status: { $in: ["SENT", "PARTIAL"] },
            dueDate: { $lt: now },
          },
          { $set: { status: "OVERDUE" } },
        );
        for (const i of await Invoice.find({ status: "OVERDUE" })) {
          await emit({
            alertType: "OVERDUE_INVOICE",
            severity: "WARNING",
            title: `Invoice ${i.invoiceNumber} is overdue`,
            entityType: "Invoice",
            entityId: i._id,
            actionUrl: `/invoices/${i._id}`,
            dedupeKey: `OVERDUE:${i._id}`,
          });
        }
      }

      // 5. Vehicle maintenance due
      const mRule = ruleByType.VEHICLE_MAINTENANCE_DUE;
      if (mRule) {
        const cutoff = new Date(now.getTime() + mRule.thresholdValue * 86_400_000);
        for (const m of await VehicleMaintenance.find({
          nextDueDate: { $gte: now, $lte: cutoff },
        })) {
          await emit({
            alertType: "VEHICLE_MAINTENANCE_DUE",
            severity: "INFO",
            title: `Maintenance due for vehicle`,
            entityType: "Vehicle",
            entityId: m.vehicleId,
            dedupeKey: `MAINT:${m._id}`,
          });
        }
      }

      // 6. Contractor agreement expiry
      const cRule = ruleByType.CONTRACTOR_AGREEMENT_EXPIRY;
      if (cRule) {
        const cutoff = new Date(now.getTime() + cRule.thresholdValue * 86_400_000);
        for (const c of await Contractor.find({
          isActive: true,
          agreementEndDate: { $gte: now, $lte: cutoff },
        })) {
          await emit({
            alertType: "CONTRACTOR_AGREEMENT_EXPIRY",
            severity: "WARNING",
            title: `Contractor ${c.name}: agreement expiring soon`,
            entityType: "Contractor",
            entityId: c._id,
            dedupeKey: `CONTRACTOR_AGREE:${c._id}`,
          });
        }
      }

      // 7. Document expiry
      const docRule = ruleByType.DOCUMENT_EXPIRY;
      if (docRule) {
        const cutoff = new Date(
          now.getTime() + docRule.thresholdValue * 86_400_000,
        );
        for (const d of await Document_.find({
          expiryDate: { $gte: now, $lte: cutoff },
        })) {
          await emit({
            alertType: "DOCUMENT_EXPIRY",
            severity: "INFO",
            title: `Document expiring: ${d.documentType}`,
            entityType: "Document",
            entityId: d._id,
            dedupeKey: `DOC_EXP:${d._id}`,
          });
        }
      }
    },
  );
}

async function main() {
  await connectMongo();
  // Run for every active tenant
  const tenants: any[] = await tenantContext.run(
    { tenantId: "", userId: "", permissions: [], systemBypass: true },
    () => Tenant.find({ isActive: true, isDeleted: { $ne: true } }).lean(),
  );
  for (const t of tenants) {
    console.log(`Running jobs for tenant ${t.name}...`);
    await runForTenant(String(t._id));
  }
  console.log("✓ Jobs complete.");
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
