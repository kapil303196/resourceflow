import { z } from "zod";
import { buildCrudRouter } from "../crud-helper";
import { MaterialGrade } from "@/models";

const createSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  qualityScore: z.number().default(0),
  pricePerUnit: z.number().min(0).default(0),
  color: z.string().default("#3B82F6"),
  isActive: z.boolean().default(true),
  sortOrder: z.number().default(0),
});

const updateSchema = createSchema.partial();

export const materialGradeRouter = buildCrudRouter({
  model: MaterialGrade,
  module: "materialGrade",
  entityType: "MaterialGrade",
  createSchema,
  updateSchema,
  defaultSort: { sortOrder: 1, name: 1 },
});
