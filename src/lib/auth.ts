import { NextAuthOptions, getServerSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { connectMongo } from "./mongo";
import { tenantContext } from "./tenant-context";
import { Role, Tenant, User } from "@/models";

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt", maxAge: 60 * 60 * 12 },
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        await connectMongo();

        // Login lookup runs without a tenant context so we can find the user
        // across the cluster. This is safe because we only ever expose the
        // matched user to the password check.
        const user = await tenantContext.run(
          { tenantId: "", userId: "", permissions: [], systemBypass: true },
          async () =>
            User.findOne({
              email: credentials.email.toLowerCase().trim(),
              isActive: true,
              isDeleted: { $ne: true },
            }).lean(),
        );

        if (!user) return null;

        const ok = await bcrypt.compare(
          credentials.password,
          (user as any).passwordHash,
        );
        if (!ok) return null;

        const [role, tenant] = await tenantContext.run(
          { tenantId: "", userId: "", permissions: [], systemBypass: true },
          async () =>
            Promise.all([
              Role.findById((user as any).roleId).lean(),
              Tenant.findById((user as any).tenantId).lean(),
            ]),
        );

        if (!tenant || !(tenant as any).isActive) return null;

        // Update lastLoginAt non-blocking
        tenantContext
          .run(
            { tenantId: "", userId: "", permissions: [], systemBypass: true },
            async () =>
              User.updateOne(
                { _id: (user as any)._id },
                { $set: { lastLoginAt: new Date() } },
              ),
          )
          .catch(() => undefined);

        return {
          id: String((user as any)._id),
          name: (user as any).name,
          email: (user as any).email,
          tenantId: String((user as any).tenantId),
          roleId: String((user as any).roleId),
          roleName: (role as any)?.name ?? "Member",
          permissions: ((role as any)?.permissions ?? []) as string[],
          tenantName: (tenant as any)?.name ?? "",
          tenantSettings: {
            materialName: (tenant as any)?.materialName ?? "Material",
            unitOfMeasure: (tenant as any)?.unitOfMeasure ?? "Tons",
            currency: (tenant as any)?.currency ?? "INR",
            timezone: (tenant as any)?.timezone ?? "Asia/Kolkata",
          },
        } as any;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.uid = (user as any).id;
        token.tenantId = (user as any).tenantId;
        token.roleId = (user as any).roleId;
        token.roleName = (user as any).roleName;
        token.permissions = (user as any).permissions;
        token.tenantName = (user as any).tenantName;
        token.tenantSettings = (user as any).tenantSettings;
      }
      // Allow refreshing permissions/tenant settings on demand from client
      if (trigger === "update" && session?.refresh && token.uid) {
        await connectMongo();
        const fresh = await tenantContext.run(
          {
            tenantId: token.tenantId as string,
            userId: token.uid as string,
            permissions: [],
            systemBypass: true,
          },
          async () => {
            const u: any = await User.findById(token.uid).lean();
            if (!u) return null;
            const r: any = await Role.findById(u.roleId).lean();
            const t: any = await Tenant.findById(u.tenantId).lean();
            return { u, r, t };
          },
        );
        if (fresh) {
          token.permissions = fresh.r?.permissions ?? [];
          token.roleName = fresh.r?.name ?? token.roleName;
          token.tenantName = fresh.t?.name ?? token.tenantName;
          token.tenantSettings = {
            materialName: fresh.t?.materialName ?? "Material",
            unitOfMeasure: fresh.t?.unitOfMeasure ?? "Tons",
            currency: fresh.t?.currency ?? "INR",
            timezone: fresh.t?.timezone ?? "Asia/Kolkata",
          };
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.uid as string;
        session.user.tenantId = token.tenantId as string;
        session.user.roleId = token.roleId as string;
        session.user.roleName = token.roleName as string;
        session.user.permissions = token.permissions as string[];
        session.user.tenantName = token.tenantName as string;
        session.user.tenantSettings = token.tenantSettings as any;
      }
      return session;
    },
  },
};

export async function auth() {
  return getServerSession(authOptions);
}
