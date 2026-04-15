const { z } = require("zod");

const genderEnum = z.enum(["MALE", "FEMALE", "OTHER", "PREFER_NOT_TO_SAY"]);

const dobSchema = z.preprocess((val) => {
  if (val === undefined || val === null || val === "") return undefined;
  if (val instanceof Date) return val;
  if (typeof val === "string") {
    const parsed = new Date(val);
    return Number.isNaN(parsed.getTime()) ? val : parsed;
  }
  return val;
}, z.date({ invalid_type_error: "Invalid date" }).refine((d) => !Number.isNaN(d.getTime()), "Invalid date"));

const baseProfileSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  adminLevel: z.string().optional(),
  licenseNumber: z.string().optional(),
  specialty: z.string().optional(),
  experience: z.number().int().min(0).optional(),
  language: z.string().optional(),
  consentStatus: z.boolean().optional(),
  allergies: z.string().trim().max(5000).optional().nullable(),
  knownMedicalConditions: z.string().trim().max(5000).optional().nullable(),
  dob: dobSchema.optional(),
  gender: genderEnum.optional(),
});

const registerSchema = z.object({
  body: z
    .object({
      email: z.string().email(),
      password: z.string().min(8),
      role: z.enum(["ADMIN", "DOCTOR", "PATIENT"]),
      profile: baseProfileSchema.optional(),
    })
    .superRefine((data, ctx) => {
      const p = data.profile || {};
      const missing = (field) =>
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["profile", field], message: `${field} is required` });

      if (data.role === "PATIENT") {
        if (!data.profile) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["profile"], message: "profile is required for PATIENT" });
        if (!p.firstName) missing("firstName");
        if (!p.lastName) missing("lastName");
      }

      if (data.role === "DOCTOR") {
        if (!data.profile) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["profile"], message: "profile is required for DOCTOR" });
        if (!p.firstName) missing("firstName");
        if (!p.lastName) missing("lastName");
        if (!p.licenseNumber) missing("licenseNumber");
        if (!p.specialty) missing("specialty");
      }

      if (data.role === "ADMIN") {
        if (!data.profile) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["profile"], message: "profile is required for ADMIN" });
        if (!p.firstName) missing("firstName");
        if (!p.lastName) missing("lastName");
      }
    }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

const loginSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(1),
    role: z.enum(["ADMIN", "DOCTOR", "PATIENT"]),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

const refreshSchema = z.object({
  body: z.object({
    refreshToken: z.string().min(10),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

const logoutSchema = z.object({
  body: z.object({
    refreshToken: z.string().min(10),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

module.exports = {
  registerSchema,
  loginSchema,
  refreshSchema,
  logoutSchema,
  genderEnum,
  dobSchema,
};
