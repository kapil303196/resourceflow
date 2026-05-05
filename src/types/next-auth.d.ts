import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      tenantId: string;
      name: string;
      email: string;
      roleId: string;
      roleName: string;
      permissions: string[];
      tenantName: string;
      tenantSettings: {
        materialName: string;
        unitOfMeasure: string;
        currency: string;
        timezone: string;
      };
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    uid: string;
    tenantId: string;
    roleId: string;
    roleName: string;
    permissions: string[];
    tenantName: string;
    tenantSettings: {
      materialName: string;
      unitOfMeasure: string;
      currency: string;
      timezone: string;
    };
  }
}
