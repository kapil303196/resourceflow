import { z } from "zod";
import { buildCrudRouter } from "../crud-helper";
import { Location } from "@/models";

const LocationType = z.enum([
  "SOURCE",
  "REFINERY",
  "WAREHOUSE",
  "CUSTOMER_SITE",
  "EXTERNAL",
]);

const createSchema = z.object({
  name: z.string().min(1),
  type: LocationType,
  address: z.string().optional(),
  coordinates: z
    .object({ lat: z.number(), lng: z.number() })
    .partial()
    .optional(),
  managerUserId: z.string().optional(),
  isActive: z.boolean().default(true),
  notes: z.string().optional(),
});

const updateSchema = createSchema.partial();

export const locationRouter = buildCrudRouter({
  model: Location,
  module: "location",
  entityType: "Location",
  createSchema,
  updateSchema,
  defaultSort: { name: 1 },
  listFilter: (extra: any) => {
    const f: any = {};
    if (extra?.type) f.type = extra.type;
    if (extra?.isActive !== undefined) f.isActive = extra.isActive;
    return f;
  },
  populate: [{ path: "managerUserId", select: "name email" }],
});
