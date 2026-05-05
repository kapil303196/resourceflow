import { z } from "zod";
import { router, protectedProcedure, requirePermission } from "../trpc";
import { Alert, AlertRule } from "@/models";

export const alertRouter = router({
  unreadCount: protectedProcedure.query(async () => {
    return Alert.countDocuments({ isRead: false });
  }),

  list: protectedProcedure
    .input(
      z
        .object({
          unreadOnly: z.boolean().optional(),
          severity: z.string().optional(),
          limit: z.number().default(50),
        })
        .optional(),
    )
    .query(async ({ input }) => {
      const filter: any = {};
      if (input?.unreadOnly) filter.isRead = false;
      if (input?.severity) filter.severity = input.severity;
      return Alert.find(filter).sort({ createdAt: -1 }).limit(input?.limit ?? 50).lean();
    }),

  markRead: protectedProcedure
    .input(z.object({ id: z.string().optional(), allUnread: z.boolean().optional() }))
    .mutation(async ({ input }) => {
      if (input.allUnread) {
        await Alert.updateMany(
          { isRead: false },
          { $set: { isRead: true, readAt: new Date() } },
        );
      } else if (input.id) {
        await Alert.findByIdAndUpdate(input.id, {
          $set: { isRead: true, readAt: new Date() },
        });
      }
      return { ok: true };
    }),

  rules: requirePermission("settings.read").query(async () => {
    return AlertRule.find({}).sort({ alertType: 1 }).lean();
  }),

  upsertRule: requirePermission("settings.update")
    .input(
      z.object({
        alertType: z.string(),
        isEnabled: z.boolean(),
        thresholdValue: z.number().optional(),
        thresholdUnit: z.string().optional(),
        channels: z
          .object({
            inApp: z.boolean(),
            email: z.boolean(),
            sms: z.boolean(),
          })
          .optional(),
      }),
    )
    .mutation(async ({ input }) => {
      await AlertRule.findOneAndUpdate(
        { alertType: input.alertType },
        { $set: input },
        { upsert: true, new: true },
      );
      return { ok: true };
    }),
});
