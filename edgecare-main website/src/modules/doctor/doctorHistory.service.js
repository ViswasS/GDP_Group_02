const { prisma } = require("../../db/prisma");
const { ApiError } = require("../../common/errors/ApiError");

const DOCTOR_PATIENT_HISTORY_INCLUDE = {
  intake: true,
  result: true,
  patient: {
    select: {
      patientId: true,
      firstName: true,
      lastName: true,
      gender: true,
      language: true,
      user: {
        select: {
          email: true,
        },
      },
    },
  },
  assignedDoctor: {
    select: {
      doctorId: true,
      firstName: true,
      lastName: true,
      specialty: true,
      user: {
        select: {
          email: true,
        },
      },
    },
  },
};

function normalizeDoctorActor(actor) {
  if (!actor || typeof actor !== "object" || Array.isArray(actor)) {
    throw new ApiError(401, "Not authenticated");
  }

  const doctorId = Number(actor.id);
  if (!Number.isFinite(doctorId)) {
    throw new ApiError(401, "Not authenticated");
  }

  if (actor.role !== "DOCTOR") {
    throw new ApiError(403, "Forbidden");
  }

  return doctorId;
}

async function getPatientCaseHistoryForDoctor({ actor, patientId } = {}) {
  const doctorId = normalizeDoctorActor(actor);
  const pid = Number(patientId);

  if (!Number.isFinite(pid)) {
    throw new ApiError(400, "Patient id is required");
  }

  const assignment = await prisma.triageCase.findFirst({
    where: {
      patientId: pid,
      assignedDoctorId: doctorId,
    },
    select: {
      id: true,
    },
  });

  if (!assignment) {
    throw new ApiError(403, "Forbidden");
  }

  const history = await prisma.triageCase.findMany({
    where: {
      patientId: pid,
    },
    orderBy: {
      submittedAt: "desc",
    },
    include: DOCTOR_PATIENT_HISTORY_INCLUDE,
  });

  return [...history].sort((a, b) => new Date(b.submittedAt || 0) - new Date(a.submittedAt || 0));
}

module.exports = {
  getPatientCaseHistoryForDoctor,
};
