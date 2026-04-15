const { z } = require("zod");

const upsertResultSchema = z.object({
  body: z.object({
    recommendation: z.string().min(5),
    confidenceScore: z.number().min(0).max(1).optional(),
    modelName: z.string().optional(),
    modelVersion: z.string().optional(),
  }),
  params: z.object({
    caseId: z.string().regex(/^\d+$/),
  }),
  query: z.object({}).optional(),
});

module.exports = { upsertResultSchema };
