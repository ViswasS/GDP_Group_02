const { prisma } = require("../../db/prisma");
const { ApiError } = require("../../common/errors/ApiError");

async function upsertResult({ actorId, actorRole, caseId, recommendation, confidenceScore, modelName, modelVersion }) {
  const cid = Number(caseId);
  const aid = Number(actorId);

  if (!["DOCTOR", "ADMIN"].includes(actorRole)) {
    throw new ApiError(403, "Only DOCTOR/ADMIN can create triage results");
  }

  const triageCase = await prisma.triageCase.findUnique({ where: { id: cid } });
  if (!triageCase) throw new ApiError(404, "Case not found");

  // If doctor, must be assigned doctor
  if (actorRole === "DOCTOR" && triageCase.assignedDoctorId !== aid) {
    throw new ApiError(403, "Doctor not assigned to this case");
  }

  let modelId = null;
  if (modelName && modelVersion) {
    const model = await prisma.aIModel.upsert({
      where: { name_version: { name: modelName, version: modelVersion } },
      create: { name: modelName, version: modelVersion },
      update: {},
      select: { id: true },
    });
    modelId = model.id;
  }

  const result = await prisma.triageResult.upsert({
    where: { caseId: cid },
    create: {
      caseId: cid,
      recommendation,
      confidenceScore: confidenceScore ?? null,
      modelId,
    },
    update: {
      recommendation,
      confidenceScore: confidenceScore ?? null,
      modelId,
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId: aid,
      action: "TRIAGE_RESULT_UPSERT",
      targetTable: "Triage_Result",
      targetId: result.id,
      metaJson: JSON.stringify({ caseId: cid }),
    },
  }).catch(() => {});

  return result;
}

module.exports = { upsertResult };
