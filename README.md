# ResourceFlow

**Multi-tenant Resource & Operations Management Platform.** First implementation targets sand mining operations (extraction → refining → warehousing → sales), but the entire data model and UI is industry-agnostic — every domain term (Sand, Tons, River, Grade A) is a tenant-configurable label, so the same codebase works for quarrying, timber, grain, minerals, aggregates, etc.

Built with **Next.js 14 (App Router) · TypeScript · tRPC · MongoDB / Mongoose · NextAuth · Tailwind + shadcn/ui · AWS S3 · Recharts**.

---

## Highlights

- **Real multi-tenancy** — every collection has `tenantId`; a Mongoose plugin auto-injects the filter via `AsyncLocalStorage` on every find/aggregate.
- **Ledger-based inventory** — current stock is always computed by aggregating `InventoryLedger`. No cached balance.
- **First-class documents** — any entity can have expiry-tracked attachments via the unified `Document` subsystem stored in S3.
- **Owned vs contracted fleet** — vehicles & drivers can be either; trips snapshot ownership and auto-accumulate cost into `ContractorPayment` per period.
- **Audit everything** — every write logs before/after, user, IP, user-agent.
- **RBAC** — roles are bundles of `<module>.<action>` permissions; per-tRPC-procedure enforcement.
- **All money** stored in minor units (paise/cents); all tonnage uses Mongoose `Decimal128`.
- **Atomic multi-doc writes** — refinery batch completion, trip completion, internal transfer, all run inside MongoDB transactions.

## Modules

Dashboard · Licenses · Extraction · Refineries · Inventory · Procurement (suppliers, POs, deliveries) · Customers · Sales orders · Invoices · Payments · Contractors · Fleet (vehicles + maintenance) · Drivers (attendance, salary, incidents) · Trips + loading slips · Documents · Reports (12+ aggregations) · Alerts · Audit log · Settings.

---

## Quick start

```bash
# 1. Install
npm install --legacy-peer-deps

# 2. Configure environment
cp .env.example .env.local
# Edit .env.local — set MONGODB_URI, NEXTAUTH_SECRET, AWS creds, etc.

# 3. Seed demo data (drops & recreates the demo tenant)
npm run seed

# 4. Run dev server
npm run dev
# Open http://localhost:3000
```

### Demo credentials (after `npm run seed`)

| Email                | Role     | Password   |
|----------------------|----------|------------|
| owner@demo.com       | Owner    | `demo1234` |
| manager@demo.com     | Manager  | `demo1234` |
| operator@demo.com    | Operator | `demo1234` |
| viewer@demo.com      | Viewer   | `demo1234` |

---

## Environment variables

| Variable                  | Required | Description |
|---------------------------|----------|-------------|
| `MONGODB_URI`             | yes      | MongoDB connection string. The DB name is taken from the URI path. |
| `NEXTAUTH_SECRET`         | yes      | 32+ byte random string. Generate with `openssl rand -hex 32`. |
| `NEXTAUTH_URL`            | yes      | App URL (e.g. `http://localhost:3000` in dev). |
| `APP_URL`                 | yes      | Same as `NEXTAUTH_URL` — used in email templates. |
| `AWS_REGION`              | yes      | S3 region. |
| `AWS_ACCESS_KEY_ID`       | yes      | IAM key for S3 (`s3:GetObject`, `s3:PutObject`, `s3:DeleteObject`). |
| `AWS_SECRET_ACCESS_KEY`   | yes      | Secret for the above key. |
| `S3_BUCKET_NAME`          | yes      | Bucket holding all tenant uploads. |
| `S3_KEY_PREFIX`           | no       | Folder prefix inside the bucket (default `resourceflow`). All keys are written as `<prefix>/<tenantId>/<entityType>/<entityId>/<uuid>-<filename>` — useful when sharing a bucket with other apps. |
| `AWS_SES_ACCESS_KEY`      | preferred| SES IAM key. When present, SES is used for transactional email. |
| `AWS_SES_SECRET_KEY`      | preferred| SES secret. |
| `AWS_SES_REGION`          | preferred| SES region (e.g. `ap-south-1`). |
| `EMAIL_FROM`              | preferred| `From:` address for SES sends. |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` | optional | SMTP fallback when SES isn't configured or fails. |

---

## Project structure

```
src/
├── app/
│   ├── (public)/        login, register (onboarding wizard), forgot/reset password
│   ├── (app)/           authenticated app shell + every module page
│   ├── api/auth/...     NextAuth handler
│   ├── api/trpc/...     tRPC handler
│   ├── globals.css
│   └── layout.tsx
├── components/
│   ├── app-shell/       Sidebar, Topbar
│   ├── ui/              shadcn primitives (button, card, dialog, table, tabs, ...)
│   ├── data-table.tsx   Reusable list with CSV export, search, pagination
│   ├── kpi-card.tsx
│   ├── page-header.tsx
│   └── status-badge.tsx
├── lib/
│   ├── auth.ts          NextAuth config (credentials + JWT + RBAC enrichment)
│   ├── base-schema.ts   Mongoose plugin: tenantId, soft delete, audit stamps
│   ├── email.ts         Transactional email (SES preferred, SMTP fallback)
│   ├── env.ts           Zod-validated env access
│   ├── mongo.ts         Connection (cached across HMR)
│   ├── permissions.ts   Permission constants + role templates
│   ├── s3.ts            Presigned PUT/GET, key builder, mime/size validation
│   ├── tenant-context.ts AsyncLocalStorage-based multi-tenant context
│   ├── trpc.ts          Client-side tRPC instance
│   └── utils.ts         cn, formatMoney, formatTonnage
├── middleware.ts        Route protection
├── models/              All Mongoose schemas (auth, config, license, sales, ...)
├── server/
│   ├── audit.ts         Audit log helper
│   ├── crud-helper.ts   Generic CRUD router builder
│   ├── routers/         All 25 tRPC routers
│   └── trpc.ts          Context, base procedures, requirePermission
└── types/next-auth.d.ts Augmented session types
scripts/
├── seed.ts              Demo data seeder
└── jobs.ts              Daily scheduled job runner (alerts engine)
```

---

## Background jobs

Run periodically (e.g. via cron or a task scheduler):

```bash
npm run jobs
```

Generates alerts (deduped via `dedupeKey`) for:

- License expiry within threshold days
- License tonnage utilization breach
- Vehicle document expiry (insurance, fitness, permit, PUC)
- Driver license expiry
- Generic document expiry
- Overdue invoices (also flips invoice status to `OVERDUE`)
- Vehicle maintenance due
- Contractor agreement expiry

Send daily/weekly digest emails per user preference (configured in user profile).

---

## S3 layout

Every key is built by `buildS3Key()` and looks like:

```
<S3_KEY_PREFIX>/<tenantId>/<entityType>/<entityId>/<uuid>-<safeFileName>
```

Example: `resourceflow/653f.../LICENSE/653f.../9c2-license-renewal-2025.pdf`.

This means:
- The bucket can be shared with other applications without collision.
- A whole tenant can be deleted in one prefix sweep.
- Per-entity attachments are easy to enumerate.

Uploads use a presigned-PUT flow:

1. Client calls `document.presignedUploadUrl` with file metadata.
2. Server validates mime + size, returns a signed URL + key.
3. Client `fetch(url, { method: "PUT", body: file })`.
4. Client calls `document.confirmUpload` with the key — server `HEAD`s the object to verify, then persists the `Document` row.

Downloads use presigned GETs (15 min expiry).

---

## Email backends

`sendEmail()` chooses the backend at runtime:

1. **Amazon SES** (preferred) — used when `AWS_SES_ACCESS_KEY` + `AWS_SES_SECRET_KEY` are configured. Plain HTML/text only; SES `SendEmail` does not handle attachments inline.
2. **SMTP / Nodemailer** — used as the fallback or when attachments are needed.
3. **No-op** — if neither is configured, sends are skipped with a console warning so dev environments don't break.

---

## Deploying

- Frontend + API: **Vercel** works out of the box (Next.js App Router). Set every env var in the Vercel dashboard.
- Database: **MongoDB Atlas** — make sure the cluster network allows your deploy region.
- File storage: any AWS S3 bucket with `s3:GetObject`, `s3:PutObject`, `s3:DeleteObject` granted to the IAM user.
- Email: AWS SES (production access for the sender domain) or any SMTP provider.
- Background jobs: run `npm run jobs` on a cron (Vercel Cron, AWS EventBridge, GitHub Actions, etc.) at least daily.

---

## License

Internal use. No license declared yet.
