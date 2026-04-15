const { z } = require("zod");

const adminCaseQueueSchema = z.object({
  query: z.object({
    status: z.enum(["SUBMITTED", "IN_REVIEW", "CLOSED"]).optional(),
    unassigned: z
      .string()
      .optional()
      .transform((v) => {
        if (v === undefined) return undefined;
        return v === "true" || v === "1";
      }),
    page: z
      .string()
      .optional()
      .transform((v) => (v ? Number(v) : 1))
      .refine((n) => Number.isInteger(n) && n >= 1, "page must be >= 1"),
    pageSize: z
      .string()
      .optional()
      .transform((v) => (v ? Number(v) : 20))
      .refine((n) => Number.isInteger(n) && n >= 1 && n <= 100, "pageSize must be 1..100"),
  }),
  params: z.object({}).optional(),
  body: z.object({}).optional(),
});

const updateAdminProfileSchema = z.object({
  body: z.object({
    firstName: z.string().min(1).optional(),
    lastName: z.string().min(1).optional(),
    adminLevel: z.string().min(1).optional(),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

const adminInsightsSchema = z.object({
  query: z.object({}).optional(),
  params: z.object({}).optional(),
  body: z.object({}).optional(),
});

module.exports = { adminCaseQueueSchema, updateAdminProfileSchema, adminInsightsSchema };
