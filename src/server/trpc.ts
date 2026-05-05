import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";
import type { NextRequest } from "next/server";
import { getServerSession, type Session } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectMongo } from "@/lib/mongo";
import { tenantContext, TenantContext } from "@/lib/tenant-context";
import { hasPermission, Permission } from "@/lib/permissions";

export type Ctx = {
  req?: NextRequest;
  ip: string;
  userAgent: string;
  session: Session | null;
};

export async function createTRPCContext(opts: { req?: NextRequest }): Promise<Ctx> {
  await connectMongo();
  const session = await getServerSession(authOptions);
  return {
    req: opts.req,
    ip:
      opts.req?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      opts.req?.headers.get("x-real-ip") ||
      "unknown",
    userAgent: opts.req?.headers.get("user-agent") ?? "unknown",
    session,
  };
}

const t = initTRPC.context<Ctx>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError: error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

export const router = t.router;
export const mergeRouters = t.mergeRouters;
export const publicProcedure = t.procedure;

/**
 * Procedure that requires an authenticated user.
 * Runs the resolver inside a tenantContext so all Mongoose queries are scoped.
 */
export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  const tctx: TenantContext = {
    tenantId: ctx.session.user.tenantId,
    userId: ctx.session.user.id,
    permissions: ctx.session.user.permissions ?? [],
  };
  return tenantContext.run(tctx, () =>
    next({
      ctx: {
        ...ctx,
        session: ctx.session!,
        user: ctx.session!.user,
        tenant: tctx,
      },
    }),
  );
});

/** Wrapper that requires a specific permission. */
export function requirePermission(perm: Permission) {
  return protectedProcedure.use(({ ctx, next }) => {
    if (!hasPermission(ctx.user.permissions, perm)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: `Missing permission: ${perm}`,
      });
    }
    return next();
  });
}

/** Convenience for read+write helpers. */
export function requireAnyPermission(perms: Permission[]) {
  return protectedProcedure.use(({ ctx, next }) => {
    const allowed =
      ctx.user.permissions.includes("*") ||
      perms.some((p) => ctx.user.permissions.includes(p));
    if (!allowed) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: `Missing one of: ${perms.join(", ")}`,
      });
    }
    return next();
  });
}
