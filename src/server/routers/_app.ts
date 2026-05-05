import { router } from "../trpc";
import { authRouter } from "./auth";
import { tenantRouter } from "./tenant";
import { userRouter } from "./user";
import { roleRouter } from "./role";
import { auditLogRouter } from "./audit-log";
import { materialGradeRouter } from "./material-grade";
import { locationRouter } from "./location";
import { refineryRouter } from "./refinery";
import { licenseRouter } from "./license";
import { extractionRouter } from "./extraction";
import { supplierRouter } from "./supplier";
import { purchaseOrderRouter } from "./purchase-order";
import { refineryBatchRouter } from "./refinery-batch";
import { inventoryRouter } from "./inventory";
import { customerRouter } from "./customer";
import { salesOrderRouter } from "./sales-order";
import { invoiceRouter } from "./invoice";
import { contractorRouter } from "./contractor";
import { vehicleRouter } from "./vehicle";
import { driverRouter } from "./driver";
import { tripRouter } from "./trip";
import { documentRouter } from "./document";
import { reportRouter } from "./report";
import { alertRouter } from "./alert";
import { settingsRouter } from "./settings";
import { dashboardRouter } from "./dashboard";

export const appRouter = router({
  auth: authRouter,
  tenant: tenantRouter,
  user: userRouter,
  role: roleRouter,
  auditLog: auditLogRouter,
  materialGrade: materialGradeRouter,
  location: locationRouter,
  refinery: refineryRouter,
  license: licenseRouter,
  extraction: extractionRouter,
  supplier: supplierRouter,
  purchaseOrder: purchaseOrderRouter,
  refineryBatch: refineryBatchRouter,
  inventory: inventoryRouter,
  customer: customerRouter,
  salesOrder: salesOrderRouter,
  invoice: invoiceRouter,
  contractor: contractorRouter,
  vehicle: vehicleRouter,
  driver: driverRouter,
  trip: tripRouter,
  document: documentRouter,
  report: reportRouter,
  alert: alertRouter,
  settings: settingsRouter,
  dashboard: dashboardRouter,
});

export type AppRouter = typeof appRouter;
