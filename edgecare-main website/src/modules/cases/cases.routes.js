const express = require("express");
const { requireAuth } = require("../../common/middleware/auth");
const { requireRole } = require("../../common/middleware/rbac");
const { validate } = require("../../common/middleware/validate");

const {
  createCaseSchema,
  caseIdParamSchema,
  updateCaseSchema,
  attachImagesSchema,
  replaceCaseImageSchema,
  mlUpdateSchema,
  doctorReviewSchema,
} = require("./cases.schemas");
const { assignDoctorSchema, requestDoctorSchema } = require("./cases.assign.schemas");

const controller = require("./cases.controller");

const casesRouter = express.Router();

// Create Case
casesRouter.post(
  "/",
  requireAuth,
  requireRole("PATIENT"),
  validate(createCaseSchema),
  controller.create
);

// Attach image URLs post-create
casesRouter.post(
  "/:id/images",
  requireAuth,
  requireRole("PATIENT", "DOCTOR", "ADMIN"),
  validate(attachImagesSchema),
  controller.attachImages
);

// Store ML outputs
casesRouter.post(
  "/:id/ml",
  requireAuth,
  requireRole("PATIENT", "DOCTOR", "ADMIN"),
  validate(mlUpdateSchema),
  controller.saveMl
);

// Replace active case image and reset AI review for the same case
casesRouter.post(
  "/:id/reupload-image",
  requireAuth,
  requireRole("PATIENT"),
  validate(replaceCaseImageSchema),
  controller.reuploadImage
);

// Patient-triggered doctor assignment
casesRouter.post(
  "/:id/request-doctor",
  requireAuth,
  requireRole("PATIENT"),
  validate(requestDoctorSchema),
  controller.requestDoctor
);

// Assigned doctor submits or updates formal review fields
casesRouter.post(
  "/:id/doctor-review",
  requireAuth,
  requireRole("DOCTOR"),
  validate(doctorReviewSchema),
  controller.saveDoctorReview
);

// Get All Cases data
casesRouter.get(
  "/",
  requireAuth,
  requireRole("PATIENT", "DOCTOR", "ADMIN"),
  controller.list
);

// Get a Single case data
casesRouter.get(
  "/:id",
  requireAuth,
  requireRole("PATIENT", "DOCTOR", "ADMIN"),
  validate(caseIdParamSchema),
  controller.getById
);

// Edit Case
casesRouter.patch(
  "/:id",
  requireAuth,
  requireRole("DOCTOR", "ADMIN"),
  validate(updateCaseSchema),
  controller.update
);

// ADMIN only: assign doctor
casesRouter.put(
  "/:id/assign-doctor",
  requireAuth,
  requireRole("ADMIN"),
  validate(assignDoctorSchema),
  controller.assignDoctor
);

// ADMIN only: delete case
casesRouter.delete(
  "/:id",
  requireAuth,
  requireRole("ADMIN"),
  validate(caseIdParamSchema),
  controller.remove
);


module.exports = { casesRouter };
