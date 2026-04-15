const express = require("express");
const { requireAuth } = require("../../common/middleware/auth");
const { validate } = require("../../common/middleware/validate");
const { upsertResultSchema } = require("./triage.schemas");

const controller = require("./triage.controller");

const triageRouter = express.Router();

triageRouter.put("/cases/:caseId/result", requireAuth, validate(upsertResultSchema), controller.upsert);

module.exports = { triageRouter };
