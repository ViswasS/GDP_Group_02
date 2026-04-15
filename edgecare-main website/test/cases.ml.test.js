const test = require("node:test");
const assert = require("node:assert");
const express = require("express");
const request = require("supertest");

const { validate } = require("../src/common/middleware/validate");
const { mlUpdateSchema } = require("../src/modules/cases/cases.schemas");

function buildApp() {
  const app = express();
  app.use(express.json());
  app.post("/api/v1/cases/:id/ml", validate(mlUpdateSchema), (req, res) => {
    res.status(200).json({ success: true, validated: req.validated.body });
  });
  return app;
}

test("POST /api/v1/cases/:id/ml accepts mlStatus and mlDebug", async () => {
  const app = buildApp();
  const payload = {
    mlImageResult: { score: 0.42 },
    mlStatus: "COMPLETED",
    mlDebug: { traceId: "abc123" },
    extraField: "kept for compatibility",
  };

  const res = await request(app).post("/api/v1/cases/123/ml").send(payload);

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.validated.mlStatus, payload.mlStatus);
  assert.deepEqual(res.body.validated.mlDebug, payload.mlDebug);
  assert.equal(res.body.validated.extraField, payload.extraField);
});
