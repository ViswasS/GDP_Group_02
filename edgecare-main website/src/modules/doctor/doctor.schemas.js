const { z } = require("zod");
const { genderEnum, dobSchema } = require("../auth/auth.schemas");

const updateDoctorProfileSchema = z.object({
  body: z.object({
    firstName: z.string().min(1).optional(),
    lastName: z.string().min(1).optional(),
    dob: dobSchema.optional(),
    gender: genderEnum.optional(),
    specialty: z.string().min(1).optional(),
    experience: z.number().int().min(0).optional(),
    licenseNumber: z.string().min(1).optional(),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

module.exports = { updateDoctorProfileSchema };
