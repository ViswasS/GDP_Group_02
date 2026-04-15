const express = require("express");
const { requireAuth } = require("../../common/middleware/auth");
const { requireRole } = require("../../common/middleware/rbac");
const { validate } = require("../../common/middleware/validate");

const { adminCaseQueueSchema, updateAdminProfileSchema, adminInsightsSchema } = require("./admin.schemas");
const controller = require("./admin.controller");

const adminRouter = express.Router();

// GET /api/v1/admin/cases?status=SUBMITTED&unassigned=true&page=1&pageSize=20
adminRouter.get(
  "/cases",
  requireAuth,
  requireRole("ADMIN"),
  validate(adminCaseQueueSchema),
  controller.caseQueue
);

// PATCH /api/v1/admin/profile
adminRouter.patch(
  "/profile",
  requireAuth,
  requireRole("ADMIN"),
  validate(updateAdminProfileSchema),
  controller.updateProfile
);

// Insights dashboard
adminRouter.get(
  "/insights/dashboard",
  requireAuth,
  requireRole("ADMIN"),
  validate(adminInsightsSchema),
  controller.insightsDashboard
);

adminRouter.get(
  "/insights/overview",
  requireAuth,
  requireRole("ADMIN"),
  validate(adminInsightsSchema),
  controller.insightsOverview
);

adminRouter.get(
  "/insights/doctors",
  requireAuth,
  requireRole("ADMIN"),
  validate(adminInsightsSchema),
  controller.insightsDoctors
);

adminRouter.get(
  "/insights/patients",
  requireAuth,
  requireRole("ADMIN"),
  validate(adminInsightsSchema),
  controller.insightsPatients
);

module.exports = { adminRouter };
