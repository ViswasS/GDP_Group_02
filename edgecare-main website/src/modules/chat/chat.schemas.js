const { z } = require("zod");

const caseIdParam = z.object({
  caseId: z.string().regex(/^\d+$/, "caseId must be a number"),
});

const getMessagesSchema = z.object({
  params: caseIdParam,
  query: z
    .object({
      cursor: z
        .string()
        .optional()
        .transform((v) => (v ? Number(v) : undefined))
        .refine((v) => v === undefined || (Number.isInteger(v) && v > 0), "cursor must be a positive integer"),
      limit: z
        .string()
        .optional()
        .transform((v) => (v ? Number(v) : 30))
        .refine((v) => Number.isInteger(v) && v >= 1 && v <= 100, "limit must be 1..100"),
    })
    .optional(),
  body: z.object({}).optional(),
});

const sendMessageSchema = z.object({
  params: caseIdParam,
  query: z.object({}).optional(),
  body: z.object({
    tempId: z.string().min(1).optional(),
    content: z.string().min(1),
    type: z.enum(["TEXT", "IMAGE", "FILE"]).optional().default("TEXT"),
  }),
});

const aiReplySchema = z.object({
  params: caseIdParam,
  query: z.object({}).optional(),
  body: z.object({
    message: z.string().min(1),
  }),
});

module.exports = { getMessagesSchema, sendMessageSchema, aiReplySchema };
