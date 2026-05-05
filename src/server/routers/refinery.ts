import { z } from "zod";
import { buildCrudRouter } from "../crud-helper";
import { Refinery } from "@/models";

const createSchema = z.object({
  locationId: z.string().min(1),
  name: z.string().min(1),
  dailyCapacityTons: z.number().min(0).default(0),
  operationalSince: z.date().optional(),
  managerUserId: z.string().optional(),
  supportedGradeIds: z.array(z.string()).default([]),
  isActive: z.boolean().default(true),
  notes: z.string().optional(),
});

const updateSchema = createSchema.partial();

export const refineryRouter = buildCrudRouter({
  model: Refinery,
  module: "refinery",
  entityType: "Refinery",
  createSchema,
  updateSchema,
  defaultSort: { name: 1 },
  populate: [
    { path: "locationId", select: "name type" },
    { path: "managerUserId", select: "name email" },
    { path: "supportedGradeIds", select: "name color" },
  ],
});
