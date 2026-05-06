import { z } from "zod";
import { Types } from "mongoose";
import { TRPCError } from "@trpc/server";
import { router, requirePermission } from "../trpc";
import { SalesOrder, MaterialGrade, InventoryLedger } from "@/models";
import { recordAudit } from "../audit";
import { nextNumber } from "../next-number";

const itemSchema = z.object({
  materialGradeId: z.string(),
  orderedTonnage: z.number().positive(),
  pricePerUnit: z.number().min(0),
});

const createInput = z.object({
  customerId: z.string(),
  orderNumber: z.string().optional(), // auto-generated server-side
  orderDate: z.date(),
  requiredByDate: z.date().optional(),
  items: z.array(itemSchema).min(1),
  notes: z.string().optional(),
});

function totalFor(items: { orderedTonnage: number; pricePerUnit: number }[]) {
  return items.reduce(
    (s, i) => s + Math.round(i.orderedTonnage * i.pricePerUnit),
    0,
  );
}

export const salesOrderRouter = router({
  list: requirePermission("salesOrder.read")
    .input(
      z
        .object({
          customerId: z.string().optional(),
          status: z.string().optional(),
          search: z.string().optional(),
          from: z.date().optional(),
          to: z.date().optional(),
        })
        .optional(),
    )
    .query(async ({ input }) => {
      const filter: any = {};
      if (input?.customerId) filter.customerId = input.customerId;
      if (input?.status) filter.status = input.status;
      if (input?.search) filter.orderNumber = { $regex: input.search, $options: "i" };
      if (input?.from || input?.to) {
        filter.orderDate = {};
        if (input.from) filter.orderDate.$gte = input.from;
        if (input.to) filter.orderDate.$lte = input.to;
      }
      const items = await SalesOrder.find(filter)
        .populate("customerId", "name")
        .sort({ orderDate: -1 })
        .lean();
      return items.map((o: any) => ({
        ...o,
        items: (o.items ?? []).map((it: any) => ({
          ...it,
          orderedTonnage: Number(it.orderedTonnage?.toString() ?? 0),
          fulfilledTonnage: Number(it.fulfilledTonnage?.toString() ?? 0),
        })),
      }));
    }),

  byId: requirePermission("salesOrder.read")
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const o: any = await SalesOrder.findById(input.id)
        .populate("customerId", "name email phone address creditDays")
        .lean();
      if (!o) throw new TRPCError({ code: "NOT_FOUND" });
      const items = await Promise.all(
        (o.items ?? []).map(async (it: any) => {
          const grade: any = await MaterialGrade.findById(it.materialGradeId).lean();
          return {
            ...it,
            orderedTonnage: Number(it.orderedTonnage?.toString() ?? 0),
            fulfilledTonnage: Number(it.fulfilledTonnage?.toString() ?? 0),
            gradeName: grade?.name,
            gradeColor: grade?.color,
          };
        }),
      );
      return { ...o, items };
    }),

  create: requirePermission("salesOrder.create")
    .input(createInput)
    .mutation(async ({ input, ctx }) => {
      const orderNumber = input.orderNumber || (await nextNumber("SO"));
      const o = await SalesOrder.create({
        ...input,
        orderNumber,
        totalAmount: totalFor(input.items),
        status: "DRAFT",
      });
      await recordAudit({
        action: "salesOrder.create",
        entityType: "SalesOrder",
        entityId: String(o._id),
        newValue: input,
        ipAddress: ctx.ip,
        userAgent: ctx.userAgent,
      });
      return { id: String(o._id) };
    }),

  update: requirePermission("salesOrder.update")
    .input(z.object({ id: z.string() }).and(createInput.partial()))
    .mutation(async ({ input }) => {
      const { id, ...rest } = input as any;
      const update: any = { ...rest };
      if (rest.items) update.totalAmount = totalFor(rest.items);
      await SalesOrder.findByIdAndUpdate(id, { $set: update });
      return { ok: true };
    }),

  setStatus: requirePermission("salesOrder.update")
    .input(
      z.object({
        id: z.string(),
        status: z.enum(["DRAFT", "CONFIRMED", "DISPATCHING", "COMPLETED", "CANCELLED"]),
      }),
    )
    .mutation(async ({ input }) => {
      await SalesOrder.findByIdAndUpdate(input.id, {
        $set: { status: input.status },
      });
      return { ok: true };
    }),

  /**
   * Stock availability check: per item, sum stock across all locations
   * and compare against orderedTonnage. Returns warnings.
   */
  stockAvailability: requirePermission("salesOrder.read")
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const o: any = await SalesOrder.findById(input.id).lean();
      if (!o) return [];
      const out: any[] = [];
      for (const it of o.items ?? []) {
        const agg = await InventoryLedger.aggregate([
          { $match: { materialGradeId: new Types.ObjectId(it.materialGradeId) } },
          {
            $group: {
              _id: null,
              total: {
                $sum: {
                  $multiply: [
                    {
                      $cond: [
                        { $in: ["$transactionType", ["OUT", "TRANSFER_OUT"]] },
                        -1,
                        1,
                      ],
                    },
                    { $toDouble: "$quantity" },
                  ],
                },
              },
            },
          },
        ]);
        const stock = agg[0]?.total ?? 0;
        const ordered = Number(it.orderedTonnage?.toString() ?? 0);
        out.push({
          materialGradeId: it.materialGradeId,
          orderedTonnage: ordered,
          availableStock: stock,
          shortfall: Math.max(0, ordered - stock),
        });
      }
      return out;
    }),
});
