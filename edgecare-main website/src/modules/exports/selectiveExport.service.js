const { ApiError } = require("../../common/errors/ApiError");
const { buildPersonalizedHealthReport } = require("../reports/healthReport.builder");

const EXPORT_RULES = {
  PATIENT: {
    reportType: true,
    generatedAt: true,
    patient: {
      patientId: true,
      patientName: true,
      firstName: true,
      lastName: true,
      gender: true,
      language: true,
      allergies: true,
      knownMedicalConditions: true,
    },
    overview: {
      reportFor: true,
      caseReference: true,
      createdAt: true,
      status: true,
    },
    aiSummary: true,
    sections: {
      assessment: {
        imageAssessment: true,
        condition: true,
        severity: true,
        careLevel: true,
      },
      guidance: {
        nextStep: true,
        recommendations: true,
      },
    },
    metadata: {
      language: true,
    },
  },
  ADMIN: {
    reportType: true,
    generatedAt: true,
    patient: {
      patientId: true,
      patientName: true,
      firstName: true,
      lastName: true,
      dob: true,
      gender: true,
      language: true,
      allergies: true,
      knownMedicalConditions: true,
      email: true,
    },
    overview: {
      reportFor: true,
      caseReference: true,
      createdAt: true,
      status: true,
    },
    aiSummary: true,
    sections: {
      assessment: {
        imageAssessment: true,
        condition: true,
        severity: true,
        careLevel: true,
        confidence: true,
      },
      guidance: {
        nextStep: true,
        recommendations: true,
      },
    },
    metadata: {
      language: true,
      consentStatus: true,
    },
  },
};

function filterAllowedFields(value, rules) {
  if (rules === true) return value;
  if (!rules || value == null || typeof value !== "object" || Array.isArray(value)) return undefined;

  const output = {};
  for (const [key, nestedRules] of Object.entries(rules)) {
    if (!(key in value)) continue;
    const filtered = filterAllowedFields(value[key], nestedRules);
    if (filtered !== undefined) output[key] = filtered;
  }
  return output;
}

function assertAuthenticatedActor(actor) {
  if (!actor || typeof actor !== "object" || Array.isArray(actor) || !actor.role || actor.id == null) {
    throw new ApiError(401, "Not authenticated");
  }
}

function assertExportPermission(actor, targetPatientId) {
  const role = String(actor.role || "").toUpperCase();
  if (role === "ADMIN") return;
  if (role === "PATIENT" && Number(actor.id) === Number(targetPatientId)) return;
  throw new ApiError(403, "Forbidden");
}

async function resolveExportSource({ sourceData, actor, targetPatientId }, deps = {}) {
  if (sourceData) return sourceData;
  if (typeof deps.fetchExportData === "function") {
    return deps.fetchExportData({ actor, targetPatientId });
  }
  throw new ApiError(400, "Export source data is required");
}

async function generateSelectiveHealthReportExport({ actor, targetPatientId, sourceData } = {}, deps = {}) {
  assertAuthenticatedActor(actor);
  assertExportPermission(actor, targetPatientId);

  const resolved = await resolveExportSource({ sourceData, actor, targetPatientId }, deps);
  const report = buildPersonalizedHealthReport({
    aiResult: resolved.aiResult,
    patientProfile: resolved.patientProfile,
    reportContext: resolved.reportContext,
  });

  const role = String(actor.role || "").toUpperCase();
  return filterAllowedFields(report, EXPORT_RULES[role]);
}

module.exports = {
  generateSelectiveHealthReportExport,
};
