const { prisma } = require("../../db/prisma");
const { ApiError } = require("../../common/errors/ApiError");

const PATIENT_PROFILE_SELECT = {
  patientId: true,
  firstName: true,
  lastName: true,
  dob: true,
  gender: true,
  language: true,
  consentStatus: true,
  allergies: true,
  knownMedicalConditions: true,
  user: {
    select: {
      id: true,
      email: true,
      role: true,
      createdAt: true,
      updatedAt: true,
    },
  },
};

const UPDATABLE_PROFILE_FIELDS = [
  "firstName",
  "lastName",
  "dob",
  "gender",
  "language",
  "consentStatus",
  "allergies",
  "knownMedicalConditions",
];

async function getProfile(userId) {
  const id = Number(userId);

  return prisma.patientProfile.findUnique({
    where: { patientId: id },
    select: PATIENT_PROFILE_SELECT,
  });
}

function normalizeUpdateContext(actorOrUserId, options = {}) {
  if (actorOrUserId == null) {
    throw new ApiError(401, "Not authenticated");
  }

  if (actorOrUserId && typeof actorOrUserId === "object" && !Array.isArray(actorOrUserId)) {
    const actorId = Number(actorOrUserId.id ?? actorOrUserId.userId);
    const actorRole = actorOrUserId.role ?? options.actorRole;
    const targetPatientId = Number(options.patientId ?? actorOrUserId.patientId ?? actorId);

    if (!Number.isFinite(actorId) || !actorRole) {
      throw new ApiError(401, "Not authenticated");
    }

    return { actorId, actorRole, targetPatientId };
  }

  const actorId = Number(actorOrUserId);
  const targetPatientId = Number(options.patientId ?? actorId);

  if (!Number.isFinite(actorId)) {
    throw new ApiError(401, "Not authenticated");
  }

  return { actorId, actorRole: options.actorRole ?? "PATIENT", targetPatientId };
}

async function updateProfile(actorOrUserId, patch = {}, options = {}) {
  const { actorId, actorRole, targetPatientId } = normalizeUpdateContext(actorOrUserId, options);

  if (actorRole !== "PATIENT" || actorId !== targetPatientId) {
    throw new ApiError(403, "Forbidden");
  }

  const data = {};
  for (const key of UPDATABLE_PROFILE_FIELDS) {
    if (patch[key] !== undefined) data[key] = patch[key];
  }

  if (!Object.keys(data).length) {
    throw new ApiError(400, "No valid profile fields provided");
  }

  const existingProfile = await prisma.patientProfile.findUnique({
    where: { patientId: targetPatientId },
    select: { patientId: true },
  });

  if (!existingProfile) {
    throw new ApiError(404, "Profile not found");
  }

  return prisma.patientProfile.update({
    where: { patientId: targetPatientId },
    data,
    select: PATIENT_PROFILE_SELECT,
  });
}

module.exports = { getProfile, updateProfile };
