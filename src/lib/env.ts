import { z } from "zod";

const envSchema = z.object({
  MONGODB_URI: z.string().min(1),
  NEXTAUTH_SECRET: z.string().min(16),
  NEXTAUTH_URL: z.string().url(),
  APP_URL: z.string().url(),
  AWS_REGION: z.string().default("us-east-1"),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  S3_BUCKET_NAME: z.string().optional(),
  S3_KEY_PREFIX: z.string().default("resourceflow"),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional(),
  // Amazon SES (preferred when configured)
  AWS_SES_ACCESS_KEY: z.string().optional(),
  AWS_SES_SECRET_KEY: z.string().optional(),
  AWS_SES_REGION: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
  AUTH_RATE_LIMIT_MAX: z.string().default("5"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success && process.env.NODE_ENV !== "test") {
  const issues = parsed.error.issues
    .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
    .join("\n");
  // Do not throw at module-eval time during Next build; warn instead.
  // eslint-disable-next-line no-console
  console.warn(`[env] Some environment variables are missing/invalid:\n${issues}`);
}

export const env = (parsed.success
  ? parsed.data
  : (process.env as unknown as z.infer<typeof envSchema>)) as z.infer<
  typeof envSchema
>;
