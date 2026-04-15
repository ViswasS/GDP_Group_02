const { ApiError } = require("../../common/errors/ApiError");
const { enrichFusedResult } = require("../cases/cases.service");

function titleize(value = "") {
  return String(value || "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function normalizeDate(iso) {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function patientDisplayName(patientProfile = {}) {
  const fullName = [patientProfile.firstName, patientProfile.lastName].filter(Boolean).join(" ").trim();
  if (fullName) return fullName;
  const email = patientProfile.user?.email || "";
  return email ? email.split("@")[0] : "Patient";
}

function patientDemographics(patientProfile = {}) {
  return {
    patientId: patientProfile.patientId ?? patientProfile.id ?? null,
    patientName: patientDisplayName(patientProfile),
    firstName: patientProfile.firstName || null,
    lastName: patientProfile.lastName || null,
    dob: normalizeDate(patientProfile.dob),
    gender: patientProfile.gender || null,
    language: patientProfile.language || null,
    allergies: patientProfile.allergies || null,
    knownMedicalConditions: patientProfile.knownMedicalConditions || null,
    email: patientProfile.user?.email || null,
  };
}

function resolveAiInputs(aiResult = {}) {
  if (!aiResult || typeof aiResult !== "object" || Array.isArray(aiResult)) {
    throw new ApiError(400, "Valid AI result JSON is required");
  }

  const fusedInput = aiResult.mlFusedResult || aiResult.fusedResult || aiResult;
  const imageInput = aiResult.mlImageResult || aiResult.imageResult || {};
  const reportInput = aiResult.mlReport || aiResult.report || {};

  if (!fusedInput || typeof fusedInput !== "object" || Array.isArray(fusedInput) || !Object.keys(fusedInput).length) {
    throw new ApiError(400, "Valid AI result JSON is required");
  }

  return {
    fusedInput,
    imageInput: imageInput && typeof imageInput === "object" && !Array.isArray(imageInput) ? imageInput : {},
    reportInput: reportInput && typeof reportInput === "object" && !Array.isArray(reportInput) ? reportInput : {},
  };
}

function buildAiSections({ rawFusedInput = {}, fusedResult = {}, imageInput = {} }) {
  const display = fusedResult.display || {};
  const recommended = fusedResult.recommended_actions || {};
  const rawRecommended =
    rawFusedInput.recommended_actions && typeof rawFusedInput.recommended_actions === "object"
      ? rawFusedInput.recommended_actions
      : {};
  const finalAssessment = fusedResult.final_disease_assessment || {};

  return {
    summary: rawFusedInput.ai_summary_text || "AI analysis summary unavailable.",
    condition: display.condition_text || finalAssessment.display_name || "Condition unclear from AI analysis",
    severity: display.severity_text || fusedResult.final_severity_level || "Pending",
    imageAssessment: display.image_assessment || imageInput.image_assessment_display || "Image review pending",
    careLevel:
      titleize(rawRecommended.care_level) ||
      display.triage_text ||
      titleize(recommended.care_level || fusedResult.triage_level || fusedResult.triage || "home_care / monitor"),
    nextStep:
      rawFusedInput.recommended_action ||
      display.next_step_text ||
      (Array.isArray(recommended.items) && recommended.items[0]) ||
      fusedResult.recommended_action ||
      fusedResult.recommendation ||
      "Continue monitoring symptoms and seek clinical review if symptoms worsen.",
    recommendations: Array.isArray(rawRecommended.items)
      ? rawRecommended.items
      : Array.isArray(recommended.items)
        ? recommended.items
        : rawFusedInput.recommended_action
          ? [rawFusedInput.recommended_action]
          : fusedResult.recommended_action
            ? [fusedResult.recommended_action]
        : [],
    confidence: finalAssessment.confidence_score ?? null,
    normalizedDisplay: display,
  };
}

function buildPersonalizedHealthReport({ aiResult, patientProfile, reportContext = {} } = {}) {
  if (!patientProfile || typeof patientProfile !== "object" || Array.isArray(patientProfile)) {
    throw new ApiError(400, "Patient profile is required");
  }

  const { fusedInput, imageInput, reportInput } = resolveAiInputs(aiResult);
  const { fusedResult } = enrichFusedResult({
    fusedResult: fusedInput,
    mlImageResult: imageInput,
    mlReport: reportInput,
  });

  const sections = buildAiSections({ rawFusedInput: fusedInput, fusedResult, imageInput });

  return {
    reportType: "PERSONALIZED_HEALTH_REPORT",
    generatedAt: new Date().toISOString(),
    patient: patientDemographics(patientProfile),
    overview: {
      reportFor: patientDisplayName(patientProfile),
      caseReference: reportContext.caseId ? `Case #${reportContext.caseId}` : null,
      createdAt: normalizeDate(reportContext.submittedAt),
      status: reportContext.status || null,
    },
    aiSummary: sections.summary,
    sections: {
      assessment: {
        imageAssessment: sections.imageAssessment,
        condition: sections.condition,
        severity: sections.severity,
        careLevel: sections.careLevel,
        confidence: sections.confidence,
      },
      guidance: {
        nextStep: sections.nextStep,
        recommendations: sections.recommendations,
      },
    },
    metadata: {
      language: patientProfile.language || null,
      consentStatus: patientProfile.consentStatus ?? null,
    },
    raw: {
      normalizedAiResult: fusedResult,
    },
  };
}

module.exports = {
  buildPersonalizedHealthReport,
};
