/**
 * Vercel Cron entry point. Configured in vercel.json (`/api/cron/daily`,
 * runs once a day at 03:00 UTC). For now this is a stub — the
 * scripts/jobs.ts logic should be moved here when we wire it up.
 *
 * Vercel signs cron requests with a header — we trust them in dev and
 * verify in production via CRON_SECRET if set.
 */
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  // Optional shared-secret check
  const expected = process.env.CRON_SECRET;
  if (expected) {
    const got = req.headers.get("authorization");
    if (got !== `Bearer ${expected}`) {
      return new NextResponse("Unauthorized", { status: 401 });
    }
  }
  // TODO: port the alert-engine logic from scripts/jobs.ts
  return NextResponse.json({ ok: true, ranAt: new Date().toISOString() });
}
