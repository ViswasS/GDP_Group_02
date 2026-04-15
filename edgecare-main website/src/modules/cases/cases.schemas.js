const { z } = require("zod");

const idParamSchema = z.object({
  id: z.string().regex(/^\d+$/, "Case id must be a number"),
});

const structuredSymptomsSchema = z.object({
  selected: z.array(z.string()).optional(),
  followUps: z.record(z.string(), z.unknown()).optional(),
  additionalNotes: z.string().optional().nullable(),
  environmentContext: z.object({
    climate: z.string().optional(),
    exposures: z.array(z.string()).optional(),
  }).optional(),
}).passthrough();

const symptomsInputSchema = z.union([z.array(z.string()), structuredSymptomsSchema]);

const createCaseSchema = z.object({
  body: z.object({
    title: z.string().min(3),
    duration: z.union([z.string(), z.number()]).optional(),
    durationDays: z.union([z.number().int().nonnegative(), z.string()]).optional(),
    durationLabel: z.string().optional(),
    medications: z.string().optional(),
    isEmergency: z.boolean().optional(),
    // optional initial description / notes
    description: z.string().optional(),
    rashLocation: z.string().optional(),
    symptoms: symptomsInputSchema.optional(),
    severity: z.number().int().min(1).max(10).optional(),
    itchiness: z.number().int().min(1).max(10).optional(),
    spreadingStatus: z.enum(["SPREADING", "SAME", "IMPROVING", "UNSURE"]).optional(),
    triggers: z.string().optional(),
    imageUrls: z.array(z.string().url()).optional(),
    mlImageResult: z.unknown().optional(),
    mlSymptomsResult: z.unknown().optional(),
    mlFusedResult: z.unknown().optional(),
    mlReport: z.unknown().optional(),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

const caseIdParamSchema = z.object({
  body: z.object({}).optional(),
  query: z.object({}).optional(),
  params: idParamSchema,
});

const updateCaseSchema = z.object({
  params: idParamSchema,
  body: z
    .object({
      title: z.string().min(3).optional(),
      duration: z.union([z.string(), z.number()]).optional().nullable(),
      durationDays: z.union([z.number().int().nonnegative(), z.string()]).optional().nullable(),
      durationLabel: z.string().optional().nullable(),
      medications: z.string().optional().nullable(),
      // optional initial description / notes (not currently persisted)
      description: z.string().optional(),
      isEmergency: z.boolean().optional(),
      status: z.enum(["SUBMITTED", "IN_REVIEW", "CLOSED"]).optional(),
      rashLocation: z.string().optional().nullable(),
      symptoms: symptomsInputSchema.optional().nullable(),
      severity: z.number().int().min(1).max(10).optional().nullable(),
      itchiness: z.number().int().min(1).max(10).optional().nullable(),
      spreadingStatus: z.enum(["SPREADING", "SAME", "IMPROVING", "UNSURE"]).optional().nullable(),
      triggers: z.string().optional().nullable(),
      imageUrls: z.array(z.string().url()).optional().nullable(),
      mlImageResult: z.unknown().optional().nullable(),
      mlSymptomsResult: z.unknown().optional().nullable(),
      mlFusedResult: z.unknown().optional().nullable(),
      mlReport: z.unknown().optional().nullable(),
    })
    .strict()
    .refine((data) => Object.keys(data).length > 0, {
      message: "At least one field must be provided",
      path: ["_root"],
    }),
  query: z.object({}).optional(),
});

const attachImagesSchema = z.object({
  params: idParamSchema,
  body: z
    .object({
      imageUrls: z.array(z.string().url()).min(1),
    })
    .strict(),
});

const replaceCaseImageSchema = z.object({
  params: idParamSchema,
  body: z
    .object({
      imageUrls: z.array(z.string().url()).min(1),
    })
    .strict(),
});

const mlUpdateSchema = z.object({
  params: idParamSchema,
  body: z
    .object({
      mlImageResult: z.unknown().optional(),
      mlSymptomsResult: z.unknown().optional(),
      mlFusedResult: z.unknown().optional(),
      mlReport: z.unknown().optional(),
      mlStatus: z.string().optional(),
      mlDebug: z.union([z.record(z.string(), z.unknown()), z.string()]).optional(),
    })
    .catchall(z.unknown())
    .refine((data) => {
      const allowedKeys = [
        "mlImageResult",
        "mlSymptomsResult",
        "mlFusedResult",
        "mlReport",
        "mlStatus",
        "mlDebug",
      ];
      return allowedKeys.some((key) => data[key] !== undefined);
    }, {
      message: "At least one ML field must be provided",
      path: ["_root"],
    }),
});

const doctorReviewSchema = z.object({
  params: idParamSchema,
  body: z
    .object({
      doctorNotes: z.string().trim().max(5000).optional().nullable(),
      doctorRecommendation: z.string().trim().max(5000).optional().nullable(),
      doctorSeverityOverride: z.enum(["mild", "moderate", "severe"]).optional().nullable(),
      doctorFollowUpNeeded: z.boolean().optional(),
    })
    .strict()
    .refine((data) => {
      const hasText = [data.doctorNotes, data.doctorRecommendation].some((value) => typeof value === "string" && value.trim());
      const hasOther = data.doctorSeverityOverride !== undefined || data.doctorFollowUpNeeded !== undefined;
      return hasText || hasOther;
    }, {
      message: "At least one doctor review field must be provided",
      path: ["_root"],
    }),
});

module.exports = {
  createCaseSchema,
  caseIdParamSchema,
  updateCaseSchema,
  attachImagesSchema,
  replaceCaseImageSchema,
  mlUpdateSchema,
  doctorReviewSchema,
};
