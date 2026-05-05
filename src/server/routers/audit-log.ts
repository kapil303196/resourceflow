import { z } from "zod";
import { router, requirePermission } from "../trpc";
import { AuditLog } from "@/models";

export const auditLogRouter = router({
  list: requirePermission("auditLog.read")
    .input(
      z
        .object({
          entityType: z.string().optional(),
          entityId: z.string().optional(),
          userId: z.string().optional(),
          action: z.string().optional(),
          from: z.date().optional(),
          to: z.date().optional(),
          limit: z.number().min(1).max(500).default(100),
          skip: z.number().min(0).default(0),
        })
        .optional(),
    )
    .query(async ({ input }) => {
      const filter: any = {};
      if (input?.entityType) filter.entityType = input.entityType;
      if (input?.entityId) filter.entityId = input.entityId;
      if (input?.userId) filter.userId = input.userId;
      if (input?.action) filter.action = { $regex: input.action, $options: "i" };
      if (input?.from || input?.to) {
        filter.createdAt = {};
        if (input.from) filter.createdAt.$gte = input.from;
        if (input.to) filter.createdAt.$lte = input.to;
      }
      const limit = input?.limit ?? 100;
      const skip = input?.skip ?? 0;
      const [items, total] = await Promise.all([
        AuditLog.find(filter)
          .populate("userId", "name email")
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        AuditLog.countDocuments(filter),
      ]);
      return { items, total };
    }),
});
