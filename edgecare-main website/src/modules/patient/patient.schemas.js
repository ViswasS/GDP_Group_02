const { z } = require("zod");
const { genderEnum, dobSchema } = require("../auth/auth.schemas");

const nullableTextField = z.preprocess((value) => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const normalized = String(value).trim();
  return normalized ? normalized : null;
}, z.string().max(5000).nullable());

const updatePatientProfileSchema = z.object({
  body: z.object({
    firstName: z.string().min(1).optional(),
    lastName: z.string().min(1).optional(),
    dob: dobSchema.optional(),
    gender: genderEnum.optional(),
    language: z.string().min(1).optional(),
    consentStatus: z.boolean().optional(),
    allergies: nullableTextField.optional(),
    knownMedicalConditions: nullableTextField.optional(),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

module.exports = { updatePatientProfileSchema };
