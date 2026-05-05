import { z } from "zod";
import { Types } from "mongoose";
import { TRPCError } from "@trpc/server";
import { router, requirePermission } from "../trpc";
import { PurchaseOrder, PurchaseDelivery, InventoryLedger } from "@/models";
import { recordAudit } from "../audit";
import { connectMongo, mongoose } from "@/lib/mongo";

const itemSchema = z.object({
  materialGradeId: z.string(),
  tonnage: z.number().positive(),
  pricePerUnit: z.number().min(0),
});

const createInput = z.object({
  supplierId: z.string(),
  poNumber: z.string().min(1),
  orderDate: z.date(),
  expectedDeliveryDate: z.date().optional(),
  items: z.array(itemSchema).min(1),
  notes: z.string().optional(),
});

function computeTotal(items: { tonnage: number; pricePerUnit: number }[]) {
  return items.reduce(
    (sum, i) => sum + Math.round(i.tonnage * i.pricePerUnit),
    0,
  );
}

export const purchaseOrderRouter = router({
  list: requirePermission("purchase.read")
    .input(
      z
        .object({
          status: z.string().optional(),
          supplierId: z.string().optional(),
          search: z.string().optional(),
          from: z.date().optional(),
          to: z.date().optional(),
        })
        .optional(),
    )
    .query(async ({ input }) => {
      const filter: any = {};
      if (input?.status) filter.status = input.status;
      if (input?.supplierId) filter.supplierId = input.supplierId;
      if (input?.search) filter.poNumber = { $regex: input.search, $options: "i" };
      if (input?.from || input?.to) {
        filter.orderDate = {};
        if (input.from) filter.orderDate.$gte = input.from;
        if (input.to) filter.orderDate.$lte = input.to;
      }
      const items = await PurchaseOrder.find(filter)
        .populate("supplierId", "name")
        .sort({ orderDate: -1 })
        .lean();
      return items.map((p: any) => ({
        ...p,
        items: (p.items ?? []).map((it: any) => ({
          ...it,
          tonnage: Number(it.tonnage?.toString() ?? 0),
        })),
      }));
    }),

  byId: requirePermission("purchase.read")
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const po: any = await PurchaseOrder.findById(input.id)
        .populate("supplierId", "name email phone")
        .lean();
      if (!po) throw new TRPCError({ code: "NOT_FOUND" });
      const deliveries = await PurchaseDelivery.find({ purchaseOrderId: input.id })
        .populate("locationId", "name")
        .populate("vehicleId", "registrationNumber")
        .sort({ deliveredDate: -1 })
        .lean();
      return {
        ...po,
        items: (po.items ?? []).map((it: any) => ({
          ...it,
          tonnage: Number(it.tonnage?.toString() ?? 0),
        })),
        deliveries: deliveries.map((d: any) => ({
          ...d,
          items: (d.items ?? []).map((it: any) => ({
            ...it,
            actualTonnage: Number(it.actualTonnage?.toString() ?? 0),
          })),
        })),
      };
    }),

  create: requirePermission("purchase.create")
    .input(createInput)
    .mutation(async ({ input, ctx }) => {
      const po = await PurchaseOrder.create({
        ...input,
        totalAmount: computeTotal(input.items),
        status: "DRAFT",
      });
      await recordAudit({
        action: "purchase.create",
        entityType: "PurchaseOrder",
        entityId: String(po._id),
        newValue: input,
        ipAddress: ctx.ip,
        userAgent: ctx.userAgent,
      });
      return { id: String(po._id) };
    }),

  update: requirePermission("purchase.update")
    .input(z.object({ id: z.string() }).and(createInput.partial()))
    .mutation(async ({ input }) => {
      const { id, ...rest } = input as any;
      const update: any = { ...rest };
      if (rest.items) update.totalAmount = computeTotal(rest.items);
      await PurchaseOrder.findByIdAndUpdate(id, { $set: update });
      return { ok: true };
    }),

  setStatus: requirePermission("purchase.update")
    .input(
      z.object({
        id: z.string(),
        status: z.enum(["DRAFT", "CONFIRMED", "DELIVERED", "PARTIAL", "CANCELLED"]),
      }),
    )
    .mutation(async ({ input }) => {
      await PurchaseOrder.findByIdAndUpdate(input.id, {
        $set: { status: input.status },
      });
      return { ok: true };
    }),

  recordDelivery: requirePermission("purchase.create")
    .input(
      z.object({
        purchaseOrderId: z.string(),
        deliveredDate: z.date(),
        items: z
          .array(
            z.object({
              materialGradeId: z.string(),
              actualTonnage: z.number().positive(),
            }),
          )
          .min(1),
        locationId: z.string(),
        vehicleId: z.string().optional(),
        notes: z.string().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const po: any = await PurchaseOrder.findById(input.purchaseOrderId);
      if (!po) throw new TRPCError({ code: "NOT_FOUND" });
      if (po.status === "CANCELLED") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "PO is cancelled." });
      }
      await connectMongo();
      const session = await mongoose.startSession();
      let deliveryId: string;
      try {
        await session.withTransaction(async () => {
          const [delivery] = await PurchaseDelivery.create(
            [
              {
                tenantId: ctx.user.tenantId,
                purchaseOrderId: input.purchaseOrderId,
                deliveredDate: input.deliveredDate,
                items: input.items,
                locationId: input.locationId,
                vehicleId: input.vehicleId,
                notes: input.notes ?? "",
                createdBy: ctx.user.id,
                updatedBy: ctx.user.id,
              },
            ],
            { session },
          );
          deliveryId = String(delivery._id);

          const ledgerDocs = input.items.map((it) => ({
            tenantId: ctx.user.tenantId,
            materialGradeId: it.materialGradeId,
            locationId: input.locationId,
            transactionType: "IN",
            quantity: it.actualTonnage,
            referenceType: "PURCHASE_DELIVERY",
            referenceId: delivery._id,
            transactionDate: input.deliveredDate,
            userId: ctx.user.id,
            createdBy: ctx.user.id,
            updatedBy: ctx.user.id,
            notes: `PO: ${po.poNumber}`,
          }));
          await InventoryLedger.insertMany(ledgerDocs, { session });

          // Update PO status
          await PurchaseOrder.findByIdAndUpdate(
            input.purchaseOrderId,
            { $set: { status: "DELIVERED" } },
            { session },
          );
        });
      } finally {
        await session.endSession();
      }
      await recordAudit({
        action: "purchase.delivery",
        entityType: "PurchaseDelivery",
        entityId: deliveryId!,
        newValue: input,
        ipAddress: ctx.ip,
        userAgent: ctx.userAgent,
      });
      return { id: deliveryId! };
    }),

  cancel: requirePermission("purchase.update")
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      await PurchaseOrder.findByIdAndUpdate(input.id, {
        $set: { status: "CANCELLED" },
      });
      return { ok: true };
    }),
});
