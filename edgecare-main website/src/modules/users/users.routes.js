const express = require("express");
const { requireAuth } = require("../../common/middleware/auth");
const { requireRole } = require("../../common/middleware/rbac");

const controller = require("./users.controller");

const usersRouter = express.Router();

// Logged-in user info
usersRouter.get("/me", requireAuth, controller.me);

// Admin: list users (used for doctor assignment)
// Example: GET /api/v1/users?role=DOCTOR
usersRouter.get("/", requireAuth, requireRole("ADMIN"), controller.listUsers);

module.exports = { usersRouter };
