import { z } from "zod";
import { buildCrudRouter } from "../crud-helper";
import { Supplier } from "@/models";

const createSchema = z.object({
  name: z.string().min(1),
  contactName: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  address: z.string().optional(),
  gstin: z.string().optional(),
  isActive: z.boolean().default(true),
  notes: z.string().optional(),
});

export const supplierRouter = buildCrudRouter({
  model: Supplier,
  module: "supplier",
  entityType: "Supplier",
  createSchema,
  updateSchema: createSchema.partial(),
  defaultSort: { name: 1 },
});
