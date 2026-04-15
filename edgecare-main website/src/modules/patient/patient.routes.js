const express = require("express");
const { requireAuth } = require("../../common/middleware/auth");
const { requireRole } = require("../../common/middleware/rbac");
const { validate } = require("../../common/middleware/validate");
const { updatePatientProfileSchema } = require("./patient.schemas");

const controller = require("./patient.controller");

const patientRouter = express.Router();

// GET /api/v1/patient/profile
patientRouter.get("/profile", requireAuth, requireRole("PATIENT"), controller.getProfile);

// PATCH /api/v1/patient/profile
patientRouter.patch(
  "/profile",
  requireAuth,
  requireRole("PATIENT"),
  validate(updatePatientProfileSchema),
  controller.updateProfile
);

module.exports = { patientRouter };

/**
 * cURL examples (replace <token>):
 * curl -H "Authorization: Bearer <patient_token>" http://localhost:3000/api/v1/patient/profile
 * curl -H "Authorization: Bearer <doctor_token>" http://localhost:3000/api/v1/patient/profile   # expected 403
 */
