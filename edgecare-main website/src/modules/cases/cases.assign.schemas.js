const { z } = require("zod");

const assignDoctorSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/),
  }),
  body: z.object({
    doctorId: z.coerce.number().int().positive(),
  }),
  query: z.object({}).optional(),
});

const requestDoctorSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/),
  }),
  body: z.object({}).optional(),
  query: z.object({}).optional(),
});

module.exports = { assignDoctorSchema, requestDoctorSchema };
