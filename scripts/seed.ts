/**
 * Seed script — populates a demo "Al Noor Sand Mining Co." tenant.
 *
 * Run with: npm run seed
 *
 * Re-running drops the existing demo tenant and recreates it.
 */
import "dotenv/config";
import path from "node:path";
// Load .env.local if present (Next.js convention)
import { config as loadEnv } from "dotenv";
loadEnv({ path: path.resolve(process.cwd(), ".env.local") });

import bcrypt from "bcryptjs";
import { connectMongo, mongoose } from "../src/lib/mongo";
import { tenantContext } from "../src/lib/tenant-context";
import { ROLE_TEMPLATES } from "../src/lib/permissions";
import {
  Tenant, User, Role, AuditLog,
  MaterialGrade, Location, Refinery, AlertRule,
  License, ExtractionBatch,
  Supplier, PurchaseOrder, PurchaseDelivery,
  RefineryBatch,
  InventoryLedger,
  Customer, SalesOrder, Invoice, Payment,
  Contractor, ContractorPayment,
  Vehicle, VehicleMaintenance,
  Driver, DriverAttendance, DriverSalaryRecord, DriverIncident,
  Trip, LoadingSlip,
  Document_,
} from "../src/models";

const DEMO_TENANT_NAME = "Al Noor Sand Mining Co.";

async function clearDemo(tenantId: string) {
  const ids = { tenantId };
  await Promise.all([
    User.deleteMany(ids),
    Role.deleteMany(ids),
    AuditLog.deleteMany(ids),
    MaterialGrade.deleteMany(ids),
    Location.deleteMany(ids),
    Refinery.deleteMany(ids),
    AlertRule.deleteMany(ids),
    License.deleteMany(ids),
    ExtractionBatch.deleteMany(ids),
    Supplier.deleteMany(ids),
    PurchaseOrder.deleteMany(ids),
    PurchaseDelivery.deleteMany(ids),
    RefineryBatch.deleteMany(ids),
    InventoryLedger.deleteMany(ids),
    Customer.deleteMany(ids),
    SalesOrder.deleteMany(ids),
    Invoice.deleteMany(ids),
    Payment.deleteMany(ids),
    Contractor.deleteMany(ids),
    ContractorPayment.deleteMany(ids),
    Vehicle.deleteMany(ids),
    VehicleMaintenance.deleteMany(ids),
    Driver.deleteMany(ids),
    DriverAttendance.deleteMany(ids),
    DriverSalaryRecord.deleteMany(ids),
    DriverIncident.deleteMany(ids),
    Trip.deleteMany(ids),
    LoadingSlip.deleteMany(ids),
    Document_.deleteMany(ids),
  ]);
}

async function main() {
  await connectMongo();
  console.log("Connected to MongoDB.");

  await tenantContext.run(
    { tenantId: "", userId: "", permissions: ["*"], systemBypass: true },
    async () => {
      // Drop existing demo tenant if any
      const existing: any = await Tenant.findOne({ name: DEMO_TENANT_NAME });
      if (existing) {
        console.log("Removing existing demo tenant...");
        await clearDemo(String(existing._id));
        await Tenant.deleteOne({ _id: existing._id });
      }

      const tenant = await Tenant.create({
        name: DEMO_TENANT_NAME,
        industryType: "Sand Mining",
        materialName: "Sand",
        unitOfMeasure: "Tons",
        currency: "INR",
        timezone: "Asia/Kolkata",
        subscriptionStatus: "ACTIVE",
        isActive: true,
      });
      const TID = String(tenant._id);
      console.log("Tenant:", tenant.name, TID);

      await tenantContext.run(
        { tenantId: TID, userId: TID, permissions: ["*"] },
        async () => {
          // Roles
          const roles: Record<string, any> = {};
          for (const [name, tmpl] of Object.entries(ROLE_TEMPLATES)) {
            roles[name] = await Role.create({
              name,
              description: tmpl.description,
              permissions: tmpl.permissions,
              isSystem: true,
            });
          }

          // Users
          const pw = await bcrypt.hash("demo1234", 12);
          const users = await User.insertMany([
            { name: "Owner Demo", email: "owner@demo.com", passwordHash: pw, roleId: roles.Owner._id, isActive: true },
            { name: "Manager Demo", email: "manager@demo.com", passwordHash: pw, roleId: roles.Manager._id, isActive: true },
            { name: "Operator Demo", email: "operator@demo.com", passwordHash: pw, roleId: roles.Operator._id, isActive: true },
            { name: "Viewer Demo", email: "viewer@demo.com", passwordHash: pw, roleId: roles.Viewer._id, isActive: true },
          ]);
          const owner = users[0];

          // Re-run nested in owner-context so audit fields are correct
          await tenantContext.run(
            { tenantId: TID, userId: String(owner._id), permissions: ["*"] },
            async () => {
              // Material grades
              const grades = await MaterialGrade.insertMany([
                { name: "Grade A", description: "Premium fine sand", qualityScore: 95, pricePerUnit: 250000, color: "#3B82F6", sortOrder: 1 },
                { name: "Grade B", description: "Standard medium sand", qualityScore: 75, pricePerUnit: 180000, color: "#F59E0B", sortOrder: 2 },
                { name: "Grade C", description: "Coarse bulk sand", qualityScore: 55, pricePerUnit: 120000, color: "#6B7280", sortOrder: 3 },
              ]);

              // Locations
              const locs = await Location.insertMany([
                { name: "River Site Alpha", type: "SOURCE", address: "Riverbank North-1, Gujarat", coordinates: { lat: 22.31, lng: 73.18 } },
                { name: "River Site Beta", type: "SOURCE", address: "Riverbank South-2, Gujarat", coordinates: { lat: 22.27, lng: 73.21 } },
                { name: "Main Refinery", type: "REFINERY", address: "Industrial Zone A" },
                { name: "South Refinery", type: "REFINERY", address: "Industrial Zone B" },
                { name: "Warehouse North", type: "WAREHOUSE", address: "Sector 18, North Hub" },
                { name: "Warehouse South", type: "WAREHOUSE", address: "Sector 22, South Hub" },
              ]);
              const [siteA, siteB, refMain, refSouth, whNorth, whSouth] = locs;

              // Refineries
              const refineries = await Refinery.insertMany([
                {
                  locationId: refMain._id,
                  name: "Main Refinery",
                  dailyCapacityTons: 500,
                  operationalSince: new Date("2020-01-01"),
                  supportedGradeIds: grades.map((g: any) => g._id),
                },
                {
                  locationId: refSouth._id,
                  name: "South Refinery",
                  dailyCapacityTons: 300,
                  operationalSince: new Date("2022-06-01"),
                  supportedGradeIds: [grades[0]._id, grades[1]._id],
                },
              ]);

              // Default alert rules
              const alertTypes = [
                "LICENSE_EXPIRY",
                "LICENSE_TONNAGE",
                "VEHICLE_DOC_EXPIRY",
                "DRIVER_LICENSE_EXPIRY",
                "DOCUMENT_EXPIRY",
                "LOW_STOCK",
                "OVERDUE_INVOICE",
                "VEHICLE_MAINTENANCE_DUE",
                "CONTRACTOR_AGREEMENT_EXPIRY",
                "REFINERY_BATCH_STUCK",
              ];
              await AlertRule.insertMany(
                alertTypes.map((t) => ({
                  alertType: t,
                  isEnabled: true,
                  thresholdValue: 30,
                  thresholdUnit: "DAYS",
                  channels: { inApp: true, email: true, sms: false },
                })),
              );

              // Licenses (1 active, 1 expiring soon, 1 expired)
              const today = new Date();
              const licenses = await License.insertMany([
                {
                  locationId: siteA._id,
                  licenseNumber: "LIC-2025-001",
                  issuingAuthority: "State Mining Department",
                  validFrom: new Date(today.getFullYear(), 0, 1),
                  validTo: new Date(today.getFullYear() + 1, 11, 31),
                  permittedTonnage: 50000,
                  usedTonnage: 12450,
                  royaltyRatePerUnit: 5000, // ₹50/ton
                  status: "ACTIVE",
                  renewalReminderDays: 60,
                },
                {
                  locationId: siteB._id,
                  licenseNumber: "LIC-2024-074",
                  validFrom: new Date(today.getFullYear() - 1, 5, 1),
                  validTo: new Date(today.getTime() + 21 * 86_400_000), // 21 days out
                  permittedTonnage: 25000,
                  usedTonnage: 18200,
                  royaltyRatePerUnit: 6000,
                  status: "ACTIVE",
                  renewalReminderDays: 30,
                },
                {
                  locationId: siteB._id,
                  licenseNumber: "LIC-2023-052",
                  validFrom: new Date(today.getFullYear() - 2, 0, 1),
                  validTo: new Date(today.getFullYear() - 1, 0, 1),
                  permittedTonnage: 40000,
                  usedTonnage: 39800,
                  royaltyRatePerUnit: 4500,
                  status: "EXPIRED",
                },
              ]);

              // Suppliers
              const suppliers = await Supplier.insertMany([
                { name: "Western Aggregates Ltd", contactName: "S. Patel", phone: "+91 90000 11111", email: "sales@western.example", gstin: "24AAACB1234X1Z5" },
                { name: "Coastal Sand Traders", contactName: "M. Khan", phone: "+91 90000 22222", email: "mk@coastal.example" },
                { name: "Grit & Gravel Co.", contactName: "P. Singh", phone: "+91 90000 33333" },
                { name: "Riverbed Suppliers", contactName: "A. Mehta", phone: "+91 90000 44444" },
              ]);

              // Customers
              const customers = await Customer.insertMany([
                { name: "BuildRight Construction", contactName: "R. Kumar", phone: "+91 99999 00001", email: "ops@buildright.example", creditLimit: 500_000_00, creditDays: 30 },
                { name: "Skyline Developers", contactName: "N. Shah", phone: "+91 99999 00002", email: "purchase@skyline.example", creditLimit: 800_000_00, creditDays: 45 },
                { name: "Concrete Masters", contactName: "T. Verma", phone: "+91 99999 00003", creditLimit: 300_000_00, creditDays: 30 },
                { name: "MetroWorks Infra", contactName: "Z. Ali", phone: "+91 99999 00004", email: "po@metroworks.example", creditLimit: 1_000_000_00, creditDays: 60 },
                { name: "PrimeMix Ready Concrete", contactName: "L. Reddy", phone: "+91 99999 00005", creditLimit: 250_000_00, creditDays: 15 },
              ]);

              // Contractors
              const contractors = await Contractor.insertMany([
                {
                  name: "RoadKings Transport",
                  type: "TRANSPORT",
                  contactName: "H. Joshi",
                  phone: "+91 88888 11111",
                  agreementStartDate: new Date(today.getFullYear() - 1, 0, 1),
                  agreementEndDate: new Date(today.getFullYear() + 1, 11, 31),
                  agreementTerms: "₹50/ton + ₹500 per trip flat",
                },
                {
                  name: "DigForce Labor Services",
                  type: "EXTRACTION_LABOR",
                  contactName: "B. Yadav",
                  phone: "+91 88888 22222",
                  agreementStartDate: new Date(today.getFullYear() - 1, 6, 1),
                  agreementEndDate: new Date(today.getFullYear() + 1, 5, 30),
                },
              ]);
              const [transportContractor] = contractors;

              // Vehicles (3 owned, 2 contracted)
              const vehicles = await Vehicle.insertMany([
                { registrationNumber: "GJ-01-AA-1001", vehicleType: "TRUCK", capacityTons: 16, ownershipType: "OWNED", insuranceExpiryDate: new Date(today.getTime() + 200 * 86_400_000), fitnessExpiryDate: new Date(today.getTime() + 90 * 86_400_000), pucExpiryDate: new Date(today.getTime() + 25 * 86_400_000) },
                { registrationNumber: "GJ-01-AA-1002", vehicleType: "TRUCK", capacityTons: 16, ownershipType: "OWNED", insuranceExpiryDate: new Date(today.getTime() + 150 * 86_400_000) },
                { registrationNumber: "GJ-01-BB-2001", vehicleType: "DUMPER", capacityTons: 22, ownershipType: "OWNED", insuranceExpiryDate: new Date(today.getTime() + 300 * 86_400_000) },
                { registrationNumber: "GJ-02-CC-3001", vehicleType: "TRUCK", capacityTons: 18, ownershipType: "CONTRACTED_TRIP", contractorId: transportContractor._id, ratePerTrip: 50000, contractStartDate: new Date(today.getFullYear() - 1, 0, 1) },
                { registrationNumber: "GJ-02-CC-3002", vehicleType: "TRACTOR", capacityTons: 12, ownershipType: "CONTRACTED_DAILY", contractorId: transportContractor._id, ratePerTrip: 35000 },
              ]);

              // Drivers
              const drivers = await Driver.insertMany([
                { name: "Ramesh Patel", phone: "+91 98765 00001", employmentType: "PERMANENT", licenseNumber: "GJ19-2010-555111", licenseExpiryDate: new Date(today.getTime() + 365 * 86_400_000), assignedVehicleId: vehicles[0]._id, salaryAmount: 25000_00, salaryCycle: "MONTHLY" },
                { name: "Suresh Kumar", phone: "+91 98765 00002", employmentType: "PERMANENT", licenseNumber: "GJ19-2012-555222", licenseExpiryDate: new Date(today.getTime() + 200 * 86_400_000), assignedVehicleId: vehicles[1]._id, salaryAmount: 24000_00, salaryCycle: "MONTHLY" },
                { name: "Mahesh Singh", phone: "+91 98765 00003", employmentType: "PERMANENT", licenseNumber: "GJ19-2015-555333", licenseExpiryDate: new Date(today.getTime() + 28 * 86_400_000), assignedVehicleId: vehicles[2]._id, salaryAmount: 28000_00, salaryCycle: "MONTHLY" },
                { name: "Naresh Yadav", phone: "+91 98765 00004", employmentType: "PERMANENT", licenseNumber: "GJ19-2017-555444", licenseExpiryDate: new Date(today.getTime() + 500 * 86_400_000), salaryAmount: 22000_00, salaryCycle: "MONTHLY" },
                { name: "Imran Khan", phone: "+91 98765 00005", employmentType: "CONTRACTOR_SUPPLIED", contractorId: transportContractor._id, licenseNumber: "GJ19-2018-666555", assignedVehicleId: vehicles[3]._id, salaryAmount: 800_00, salaryCycle: "PER_TRIP" },
                { name: "Pradeep Sharma", phone: "+91 98765 00006", employmentType: "CONTRACTOR_SUPPLIED", contractorId: transportContractor._id, assignedVehicleId: vehicles[4]._id, salaryAmount: 600_00, salaryCycle: "PER_TRIP" },
              ]);

              // Extraction batches
              const extractions: any[] = [];
              for (let i = 0; i < 10; i++) {
                const license = i < 6 ? licenses[0] : licenses[1];
                const tonnage = 800 + Math.floor(Math.random() * 1500);
                const date = new Date(today.getTime() - (i + 1) * 3 * 86_400_000);
                extractions.push(
                  await ExtractionBatch.create({
                    licenseId: license._id,
                    locationId: license.locationId,
                    extractedDate: date,
                    grossTonnage: tonnage,
                    operatorUserId: owner._id,
                    vehicleId: vehicles[i % vehicles.length]._id,
                    status: i < 3 ? "REFINED" : i < 6 ? "AT_REFINERY" : "PENDING",
                    royaltyAmount: tonnage * (license.royaltyRatePerUnit ?? 0),
                  }),
                );
              }

              // Refinery batches with output splits — process first 5 extractions
              for (let i = 0; i < 5; i++) {
                const e = extractions[i];
                const inputT = Number((e as any).grossTonnage.toString());
                const loss = Math.round(inputT * 0.02 * 100) / 100;
                const usable = inputT - loss;
                // Split: 40% A, 35% B, 25% C
                const aT = Math.round(usable * 0.4 * 100) / 100;
                const bT = Math.round(usable * 0.35 * 100) / 100;
                const cT = Math.round((usable - aT - bT) * 100) / 100;
                await RefineryBatch.create({
                  refineryId: refineries[i % 2]._id,
                  sourceType: "EXTRACTION",
                  sourceId: e._id,
                  processedDate: new Date(e.extractedDate.getTime() + 86_400_000),
                  inputTonnage: inputT,
                  processingLoss: loss,
                  status: i < 3 ? "COMPLETED" : "IN_PROGRESS",
                  operatorUserId: owner._id,
                  outputs: [
                    { materialGradeId: grades[0]._id, tonnage: aT, locationId: whNorth._id },
                    { materialGradeId: grades[1]._id, tonnage: bT, locationId: whSouth._id },
                    { materialGradeId: grades[2]._id, tonnage: cT, locationId: whSouth._id },
                  ],
                });
                if (i < 3) {
                  // Post inventory IN for completed batches
                  await InventoryLedger.insertMany([
                    { materialGradeId: grades[0]._id, locationId: whNorth._id, transactionType: "IN", quantity: aT, referenceType: "REFINERY_BATCH", transactionDate: new Date(e.extractedDate.getTime() + 86_400_000), userId: owner._id },
                    { materialGradeId: grades[1]._id, locationId: whSouth._id, transactionType: "IN", quantity: bT, referenceType: "REFINERY_BATCH", transactionDate: new Date(e.extractedDate.getTime() + 86_400_000), userId: owner._id },
                    { materialGradeId: grades[2]._id, locationId: whSouth._id, transactionType: "IN", quantity: cT, referenceType: "REFINERY_BATCH", transactionDate: new Date(e.extractedDate.getTime() + 86_400_000), userId: owner._id },
                  ]);
                }
              }

              // Opening inventory at warehouses
              await InventoryLedger.insertMany([
                { materialGradeId: grades[0]._id, locationId: whNorth._id, transactionType: "OPENING", quantity: 1500, transactionDate: new Date(today.getFullYear(), 0, 1), referenceType: "OPENING", userId: owner._id, notes: "Year-open" },
                { materialGradeId: grades[1]._id, locationId: whNorth._id, transactionType: "OPENING", quantity: 1200, transactionDate: new Date(today.getFullYear(), 0, 1), referenceType: "OPENING", userId: owner._id },
                { materialGradeId: grades[2]._id, locationId: whSouth._id, transactionType: "OPENING", quantity: 800, transactionDate: new Date(today.getFullYear(), 0, 1), referenceType: "OPENING", userId: owner._id },
              ]);

              // Sales orders + Invoices (mixed states)
              const salesOrders: any[] = [];
              for (let i = 0; i < 8; i++) {
                const cust = customers[i % customers.length];
                const items = [
                  { materialGradeId: grades[0]._id, orderedTonnage: 50 + i * 10, pricePerUnit: 250000, fulfilledTonnage: i < 4 ? 50 + i * 10 : i < 6 ? 25 : 0 },
                ];
                const total = items.reduce((s, it) => s + Math.round(it.orderedTonnage * it.pricePerUnit), 0);
                const so = await SalesOrder.create({
                  customerId: cust._id,
                  orderNumber: `SO-${String(1000 + i)}`,
                  orderDate: new Date(today.getTime() - (i + 1) * 5 * 86_400_000),
                  requiredByDate: new Date(today.getTime() + 7 * 86_400_000),
                  items,
                  totalAmount: total,
                  status: i < 4 ? "COMPLETED" : i < 6 ? "DISPATCHING" : "CONFIRMED",
                });
                salesOrders.push(so);
              }

              for (let i = 0; i < 6; i++) {
                const so = salesOrders[i];
                const inv = await Invoice.create({
                  salesOrderId: so._id,
                  customerId: so.customerId,
                  invoiceNumber: `INV-${String(2000 + i)}`,
                  invoiceDate: so.orderDate,
                  dueDate: new Date(so.orderDate.getTime() + 30 * 86_400_000),
                  totalAmount: so.totalAmount,
                  paidAmount: i < 2 ? so.totalAmount : i < 4 ? Math.round(so.totalAmount * 0.5) : 0,
                  status: i < 2 ? "PAID" : i < 4 ? "PARTIAL" : i < 5 ? "SENT" : "OVERDUE",
                });
                if (i < 4) {
                  await Payment.create({
                    invoiceId: inv._id,
                    paymentDate: new Date(inv.invoiceDate.getTime() + 7 * 86_400_000),
                    amount: i < 2 ? inv.totalAmount : Math.round(inv.totalAmount * 0.5),
                    method: "BANK_TRANSFER",
                    referenceNumber: `BT-${10000 + i}`,
                    recordedByUserId: owner._id,
                  });
                }
              }

              // Purchase orders + deliveries
              const pos = await PurchaseOrder.insertMany([
                {
                  supplierId: suppliers[0]._id,
                  poNumber: "PO-3001",
                  orderDate: new Date(today.getTime() - 14 * 86_400_000),
                  expectedDeliveryDate: new Date(today.getTime() - 7 * 86_400_000),
                  items: [{ materialGradeId: grades[0]._id, tonnage: 200, pricePerUnit: 200000 }],
                  totalAmount: 200 * 200000,
                  status: "DELIVERED",
                },
                {
                  supplierId: suppliers[1]._id,
                  poNumber: "PO-3002",
                  orderDate: new Date(today.getTime() - 8 * 86_400_000),
                  items: [{ materialGradeId: grades[2]._id, tonnage: 300, pricePerUnit: 100000 }],
                  totalAmount: 300 * 100000,
                  status: "CONFIRMED",
                },
                {
                  supplierId: suppliers[2]._id,
                  poNumber: "PO-3003",
                  orderDate: new Date(today.getTime() - 2 * 86_400_000),
                  items: [{ materialGradeId: grades[1]._id, tonnage: 150, pricePerUnit: 170000 }],
                  totalAmount: 150 * 170000,
                  status: "DRAFT",
                },
              ]);
              await PurchaseDelivery.insertMany([
                {
                  purchaseOrderId: pos[0]._id,
                  deliveredDate: new Date(today.getTime() - 7 * 86_400_000),
                  items: [{ materialGradeId: grades[0]._id, actualTonnage: 200 }],
                  locationId: whNorth._id,
                  vehicleId: vehicles[0]._id,
                },
              ]);
              await InventoryLedger.create({
                materialGradeId: grades[0]._id,
                locationId: whNorth._id,
                transactionType: "IN",
                quantity: 200,
                referenceType: "PURCHASE_DELIVERY",
                transactionDate: new Date(today.getTime() - 7 * 86_400_000),
                userId: owner._id,
                notes: "PO: PO-3001",
              });

              // Trips
              const trips: any[] = [];
              for (let i = 0; i < 15; i++) {
                const v = vehicles[i % vehicles.length];
                const driver = drivers.find((d: any) => String(d.assignedVehicleId) === String(v._id)) || drivers[0];
                const owned = v.ownershipType === "OWNED" || v.ownershipType === "LEASED";
                const t = await Trip.create({
                  tripNumber: `T-${5000 + i}`,
                  vehicleId: v._id,
                  driverId: driver._id,
                  vehicleOwnershipSnapshot: owned ? "OWNED" : "CONTRACTED",
                  contractorId: owned ? undefined : v.contractorId,
                  salesOrderId: i < 8 ? salesOrders[i]._id : undefined,
                  tripType: i < 8 ? "DELIVERY" : i < 12 ? "EXTRACTION" : "INTERNAL_TRANSFER",
                  status: i < 10 ? "COMPLETED" : i < 13 ? "IN_TRANSIT" : "SCHEDULED",
                  scheduledDate: new Date(today.getTime() - (i + 1) * 86_400_000),
                  fromLocationId: i < 8 ? whNorth._id : (siteA._id),
                  toLocationId: i < 8 ? customers[i % customers.length]._id : refMain._id,
                  plannedTonnage: 16,
                  actualTonnage: i < 10 ? 15 + Math.random() * 1 : 0,
                  distanceKm: 35 + Math.floor(Math.random() * 30),
                  tripCost: owned ? 0 : v.ratePerTrip ?? 0,
                  fuelCost: 250000,
                  materials: [{ materialGradeId: grades[i % 3]._id, tonnage: 15 }],
                });
                trips.push(t);
              }

              // Loading slips for first 10 trips
              for (let i = 0; i < 10; i++) {
                await LoadingSlip.create({
                  tripId: trips[i]._id,
                  slipNumber: `SLIP-${7000 + i}`,
                  issuedAt: trips[i].scheduledDate,
                  issuedByUserId: owner._id,
                  materialGradeId: grades[i % 3]._id,
                  weightIn: 5000,
                  weightOut: 21000,
                  netTonnage: 16,
                });
              }

              // Sample documents (metadata only — no actual S3 files)
              await Document_.insertMany([
                { entityType: "LICENSE", entityId: licenses[0]._id, documentType: "License Certificate", documentNumber: "LIC-2025-001", s3Key: `resourceflow/${TID}/seed/license-2025-001.pdf`, fileSize: 102400, mimeType: "application/pdf", originalFileName: "license-2025-001.pdf", expiryDate: licenses[0].validTo, uploadedByUserId: owner._id, isVerified: true },
                { entityType: "VEHICLE", entityId: vehicles[0]._id, documentType: "Insurance Policy", s3Key: `resourceflow/${TID}/seed/insurance-${vehicles[0].registrationNumber}.pdf`, fileSize: 56000, mimeType: "application/pdf", originalFileName: "insurance.pdf", expiryDate: vehicles[0].insuranceExpiryDate, uploadedByUserId: owner._id, isVerified: true },
                { entityType: "DRIVER", entityId: drivers[0]._id, documentType: "Driving License", documentNumber: drivers[0].licenseNumber, s3Key: `resourceflow/${TID}/seed/driver-${drivers[0].licenseNumber}.pdf`, fileSize: 18000, mimeType: "application/pdf", originalFileName: "license.pdf", expiryDate: drivers[0].licenseExpiryDate, uploadedByUserId: owner._id, isVerified: true },
              ]);

              // Sample audit log
              await AuditLog.insertMany([
                { userId: owner._id, action: "tenant.create", entityType: "Tenant", entityId: tenant._id, ipAddress: "127.0.0.1" },
                { userId: owner._id, action: "license.create", entityType: "License", entityId: licenses[0]._id, ipAddress: "127.0.0.1" },
                { userId: owner._id, action: "extraction.create", entityType: "ExtractionBatch", entityId: extractions[0]._id, ipAddress: "127.0.0.1" },
              ]);
            },
          );
        },
      );
    },
  );

  console.log("\n✓ Seed complete.");
  console.log("\nDemo credentials (password: demo1234):");
  console.log("  owner@demo.com    — Owner (full access)");
  console.log("  manager@demo.com  — Manager");
  console.log("  operator@demo.com — Operator");
  console.log("  viewer@demo.com   — Viewer");
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
