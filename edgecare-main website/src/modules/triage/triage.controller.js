const service = require("./triage.service");

async function upsert(req, res, next) {
  try {
    const { recommendation, confidenceScore, modelName, modelVersion } = req.validated.body;
    const result = await service.upsertResult({
      actorId: req.user.id,
      actorRole: req.user.role,
      caseId: req.validated.params.caseId,
      recommendation,
      confidenceScore,
      modelName,
      modelVersion,
    });

    res.json({ success: true, data: result, message: "Triage result saved" });
  } catch (e) {
    next(e);
  }
}

module.exports = { upsert };
