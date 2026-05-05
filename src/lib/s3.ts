import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { v4 as uuidv4 } from "uuid";
import { env } from "./env";

export const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "text/csv",
  "text/plain",
]);

export const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

let _client: S3Client | null = null;

export function s3Client(): S3Client {
  if (_client) return _client;
  _client = new S3Client({
    region: env.AWS_REGION,
    credentials: env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY
      ? {
          accessKeyId: env.AWS_ACCESS_KEY_ID,
          secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
        }
      : undefined,
  });
  return _client;
}

export function bucket(): string {
  if (!env.S3_BUCKET_NAME) throw new Error("S3_BUCKET_NAME is not configured");
  return env.S3_BUCKET_NAME;
}

/** Build a path scoped to this app and tenant. Strips path traversal characters. */
export function buildS3Key(opts: {
  tenantId: string;
  entityType: string;
  entityId: string;
  fileName: string;
}) {
  const safeName = opts.fileName.replace(/[^A-Za-z0-9._-]/g, "_").slice(-180);
  const prefix = env.S3_KEY_PREFIX ? `${env.S3_KEY_PREFIX}/` : "";
  return `${prefix}${opts.tenantId}/${opts.entityType}/${opts.entityId}/${uuidv4()}-${safeName}`;
}

export async function generatePresignedPutUrl(opts: {
  key: string;
  mimeType: string;
  fileSize: number;
}) {
  if (!ALLOWED_MIME_TYPES.has(opts.mimeType)) {
    throw new Error(`Mime type not allowed: ${opts.mimeType}`);
  }
  if (opts.fileSize <= 0 || opts.fileSize > MAX_FILE_SIZE) {
    throw new Error(`Invalid file size: ${opts.fileSize}`);
  }
  const cmd = new PutObjectCommand({
    Bucket: bucket(),
    Key: opts.key,
    ContentType: opts.mimeType,
    ContentLength: opts.fileSize,
  });
  const url = await getSignedUrl(s3Client(), cmd, { expiresIn: 60 * 15 });
  return { url, headers: { "Content-Type": opts.mimeType } };
}

export async function generatePresignedGetUrl(key: string, opts?: { downloadName?: string }) {
  const cmd = new GetObjectCommand({
    Bucket: bucket(),
    Key: key,
    ResponseContentDisposition: opts?.downloadName
      ? `attachment; filename="${opts.downloadName.replace(/"/g, "")}"`
      : undefined,
  });
  return getSignedUrl(s3Client(), cmd, { expiresIn: 60 * 15 });
}

export async function deleteS3Object(key: string) {
  await s3Client().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
}

export async function headS3Object(key: string) {
  try {
    const out = await s3Client().send(new HeadObjectCommand({ Bucket: bucket(), Key: key }));
    return { exists: true, size: out.ContentLength ?? 0, mimeType: out.ContentType ?? "" };
  } catch {
    return { exists: false, size: 0, mimeType: "" };
  }
}

/**
 * Upload a buffer directly. Used by server-generated artifacts
 * (PDFs for invoices/loading slips).
 */
export async function uploadBuffer(opts: {
  key: string;
  body: Buffer;
  mimeType: string;
}) {
  await s3Client().send(
    new PutObjectCommand({
      Bucket: bucket(),
      Key: opts.key,
      Body: opts.body,
      ContentType: opts.mimeType,
    }),
  );
}
