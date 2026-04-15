const { prisma } = require("../../db/prisma");
const { ApiError } = require("../../common/errors/ApiError");

/**
 * Check if a user can access chat for a case.
 * @param {{id:number, role:string}} user
 * @param {number} caseId
 * @returns {Promise<boolean>}
 */
async function canAccessCaseChat(user, caseId) {
  const cid = Number(caseId);
  if (!user || Number.isNaN(cid)) return false;

  if (user.role === "ADMIN") return true;

  const triageCase = await prisma.triageCase.findUnique({
    where: { id: cid },
    select: { patientId: true, assignedDoctorId: true },
  });
  if (!triageCase) throw new ApiError(404, "Case not found");

  if (user.role === "PATIENT" && triageCase.patientId === Number(user.id)) return true;
  if (user.role === "DOCTOR" && triageCase.assignedDoctorId === Number(user.id)) return true;

  return false;
}

async function assertCaseChatAccess(user, caseId) {
  const ok = await canAccessCaseChat(user, caseId);
  if (!ok) throw new ApiError(403, "Forbidden");
  return true;
}

module.exports = { canAccessCaseChat, assertCaseChatAccess };
