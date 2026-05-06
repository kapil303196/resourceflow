import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, requirePermission, protectedProcedure } from "../trpc";
import { tenantStamp } from "../tenant-stamp";
import { Document_, DOCUMENT_ENTITY_TYPES } from "@/models/document";
import {
  buildS3Key,
  generatePresignedPutUrl,
  generatePresignedGetUrl,
  deleteS3Object,
  headS3Object,
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE,
} from "@/lib/s3";

const entityTypeEnum = z.enum(DOCUMENT_ENTITY_TYPES);

export const documentRouter = router({
  presignedUploadUrl: requirePermission("document.create")
    .input(
      z.object({
        entityType: entityTypeEnum,
        entityId: z.string(),
        documentType: z.string().min(1),
        documentNumber: z.string().optional(),
        fileName: z.string().min(1),
        mimeType: z.string(),
        fileSize: z.number().min(1).max(MAX_FILE_SIZE),
        expiryDate: z.date().optional(),
        notes: z.string().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      if (!ALLOWED_MIME_TYPES.has(input.mimeType)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Mime type ${input.mimeType} not allowed`,
        });
      }
      const key = buildS3Key({
        tenantId: ctx.user.tenantId,
        entityType: input.entityType,
        entityId: input.entityId,
        fileName: input.fileName,
      });
      const presigned = await generatePresignedPutUrl({
        key,
        mimeType: input.mimeType,
        fileSize: input.fileSize,
      });
      return { ...presigned, key };
    }),

  /** After client uploads to S3, persist the document record. */
  confirmUpload: requirePermission("document.create")
    .input(
      z.object({
        entityType: entityTypeEnum,
        entityId: z.string(),
        documentType: z.string().min(1),
        documentNumber: z.string().optional(),
        s3Key: z.string().min(1),
        fileSize: z.number().min(0),
        mimeType: z.string(),
        originalFileName: z.string().min(1),
        expiryDate: z.date().optional(),
        notes: z.string().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const head = await headS3Object(input.s3Key);
      if (!head.exists) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Upload not received by S3 yet — try again.",
        });
      }
      const doc = await Document_.create({
        ...input,
        ...tenantStamp(),
        uploadedByUserId: ctx.user.id,
      });
      return { id: String(doc._id) };
    }),

  presignedDownloadUrl: requirePermission("document.read")
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const doc: any = await Document_.findById(input.id).lean();
      if (!doc) throw new TRPCError({ code: "NOT_FOUND" });
      const url = await generatePresignedGetUrl(doc.s3Key, {
        downloadName: doc.originalFileName,
      });
      return { url, fileName: doc.originalFileName, mimeType: doc.mimeType };
    }),

  list: requirePermission("document.read")
    .input(
      z
        .object({
          entityType: entityTypeEnum.optional(),
          entityId: z.string().optional(),
          documentType: z.string().optional(),
          isVerified: z.boolean().optional(),
          search: z.string().optional(),
          expiringInDays: z.number().optional(),
          limit: z.number().default(100),
          skip: z.number().default(0),
        })
        .optional(),
    )
    .query(async ({ input }) => {
      const filter: any = {};
      if (input?.entityType) filter.entityType = input.entityType;
      if (input?.entityId) filter.entityId = input.entityId;
      if (input?.documentType) filter.documentType = input.documentType;
      if (input?.isVerified !== undefined) filter.isVerified = input.isVerified;
      if (input?.search) {
        filter.$or = [
          { documentType: { $regex: input.search, $options: "i" } },
          { documentNumber: { $regex: input.search, $options: "i" } },
          { originalFileName: { $regex: input.search, $options: "i" } },
        ];
      }
      if (input?.expiringInDays !== undefined) {
        const cutoff = new Date(Date.now() + input.expiringInDays * 86_400_000);
        filter.expiryDate = { $gte: new Date(), $lte: cutoff };
      }
      const limit = input?.limit ?? 100;
      const skip = input?.skip ?? 0;
      const [items, total] = await Promise.all([
        Document_.find(filter)
          .populate("uploadedByUserId", "name")
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        Document_.countDocuments(filter),
      ]);
      return { items, total };
    }),

  expiringSoon: requirePermission("document.read")
    .input(z.object({ days: z.number().default(30) }))
    .query(async ({ input }) => {
      const cutoff = new Date(Date.now() + input.days * 86_400_000);
      return Document_.find({
        expiryDate: { $gte: new Date(), $lte: cutoff },
      })
        .sort({ expiryDate: 1 })
        .lean();
    }),

  markVerified: requirePermission("document.update")
    .input(z.object({ id: z.string(), verified: z.boolean() }))
    .mutation(async ({ input, ctx }) => {
      await Document_.findByIdAndUpdate(input.id, {
        $set: {
          isVerified: input.verified,
          verifiedByUserId: input.verified ? ctx.user.id : undefined,
          verifiedAt: input.verified ? new Date() : undefined,
        },
      });
      return { ok: true };
    }),

  delete: requirePermission("document.delete")
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      const doc: any = await Document_.findById(input.id).lean();
      if (!doc) throw new TRPCError({ code: "NOT_FOUND" });
      try {
        await deleteS3Object(doc.s3Key);
      } catch {
        // ignore S3 errors during cleanup
      }
      await Document_.findByIdAndUpdate(input.id, { $set: { isDeleted: true } });
      return { ok: true };
    }),
});
