const express = require("express");
const { requireAuth } = require("../../common/middleware/auth");
const { requireRole } = require("../../common/middleware/rbac");
const { validate } = require("../../common/middleware/validate");
const { updateDoctorProfileSchema } = require("./doctor.schemas");

const controller = require("./doctor.controller");

const doctorRouter = express.Router();

// GET /api/v1/doctor/profile
doctorRouter.get("/profile", requireAuth, requireRole("DOCTOR"), controller.getProfile);

// PATCH /api/v1/doctor/profile
doctorRouter.patch(
  "/profile",
  requireAuth,
  requireRole("DOCTOR"),
  validate(updateDoctorProfileSchema),
  controller.updateProfile
);

module.exports = { doctorRouter };

/**
 * cURL examples (replace <token>):
 * curl -H "Authorization: Bearer <doctor_token>" http://localhost:3000/api/v1/doctor/profile
 * curl -H "Authorization: Bearer <patient_token>" http://localhost:3000/api/v1/doctor/profile   # expected 403
 */
