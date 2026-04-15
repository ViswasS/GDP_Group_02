const { prisma } = require("../../db/prisma");
const { ApiError } = require("../../common/errors/ApiError");
const { US_EMERGENCY_CONTACTS, withTelHref } = require("../../common/constants/emergency-contacts");

const ACTIVE_CASE_STATUSES = ["SUBMITTED", "IN_REVIEW"];
const isMysql = (process.env.DATABASE_URL || "").startsWith("mysql");
const SYSTEM_ACTOR_ID = 0;
const CASE_DETAILS_INCLUDE = {
  intake: true,
  result: true,
  images: true,
  patient: {
    select: {
      patientId: true,
      firstName: true,
      lastName: true,
      allergies: true,
      knownMedicalConditions: true,
      user: { select: { email: true, role: true } },
    },
  },
  assignedDoctor: {
    select: {
      doctorId: true,
      firstName: true,
      lastName: true,
      specialty: true,
      user: { select: { email: true, role: true } },
    },
  },
  reviews: true,
};

async function pickDoctorForAutoAssign(db = prisma) {
  const doctors = await db.doctorProfile.findMany({
    where: {
      user: { role: "DOCTOR" },
    },
    select: {
      doctorId: true,
      experience: true,
      _count: {
        select: {
          assignedCases: {
            where: { status: { in: ACTIVE_CASE_STATUSES } },
          },
        },
      },
    },
  });

  if (!doctors.length) return null;

  doctors.sort((a, b) => {
    const aCount = a._count?.assignedCases ?? 0;
    const bCount = b._count?.assignedCases ?? 0;
    if (aCount !== bCount) return aCount - bCount; // lowest active load first
    if (a.experience !== b.experience) return b.experience - a.experience; // more experience first
    return a.doctorId - b.doctorId; // deterministic tie-breaker
  });

  return doctors[0]?.doctorId ?? null;
}

function aiSeverityLabel(fused) {
  if (!fused) return "Unknown";
  const direct =
    fused.severity_level || fused.severity || fused.risk_level || fused.fused_label || fused.severityLabel || null;
  if (direct) return String(direct);
  const score = typeof fused.image_severity_score === "number" ? fused.image_severity_score : null;
  if (score !== null) {
    if (score >= 0.75) return "High";
    if (score >= 0.4) return "Moderate";
    return "Low";
  }
  return "Unknown";
}

function normalizeConditionName(name) {
  if (!name) return null;
  return String(name)
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function confidenceBandFromScore(score) {
  const n = typeof score === "number" ? score : Number(score);
  if (!Number.isFinite(n)) return "low";
  if (n >= 0.8) return "high";
  if (n >= 0.5) return "medium";
  return "low";
}

function mapTriageToCareLevel(raw) {
  const v = String(raw || "").toLowerCase();
  if (["emergent", "emergency", "urgent", "high"].includes(v)) return "urgent_attention";
  if (["priority", "escalated", "moderate", "priority_review"].includes(v)) return "priority_review";
  if (["routine", "low", "mild", "review"].includes(v)) return "routine_review";
  return "home_care";
}

function normalizeSymptomsPayload(symptoms) {
  if (Array.isArray(symptoms)) {
    return symptoms.length ? symptoms : null;
  }

  if (!symptoms || typeof symptoms !== "object") return null;

  const selected = Array.isArray(symptoms.selected) ? symptoms.selected.filter(Boolean) : [];
  const followUps =
    symptoms.followUps && typeof symptoms.followUps === "object" && !Array.isArray(symptoms.followUps)
      ? symptoms.followUps
      : null;
  const additionalNotes =
    typeof symptoms.additionalNotes === "string" && symptoms.additionalNotes.trim()
      ? symptoms.additionalNotes.trim()
      : null;
  const environmentContext =
    symptoms.environmentContext && typeof symptoms.environmentContext === "object"
      ? {
          ...(typeof symptoms.environmentContext.climate === "string" && symptoms.environmentContext.climate.trim()
            ? { climate: symptoms.environmentContext.climate.trim() }
            : {}),
          ...(Array.isArray(symptoms.environmentContext.exposures) && symptoms.environmentContext.exposures.length
            ? { exposures: symptoms.environmentContext.exposures.filter(Boolean) }
            : {}),
        }
      : null;

  if (
    !selected.length &&
    !additionalNotes &&
    !(followUps && Object.keys(followUps).length) &&
    !(environmentContext && Object.keys(environmentContext).length)
  ) {
    return null;
  }

  return {
    selected,
    ...(followUps && Object.keys(followUps).length ? { followUps } : {}),
    ...(additionalNotes ? { additionalNotes } : {}),
    ...(environmentContext && Object.keys(environmentContext).length ? { environmentContext } : {}),
  };
}

const SEVERITY_WORDS = new Set(["mild", "moderate", "severe", "uncertain", "low", "high", "unknown"]);
const DEFAULT_MONITOR_TEXT = "Monitor symptoms or retake a clearer image if needed";
function titleize(str) {
  return String(str || "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function careLabel(level) {
  const v = mapTriageToCareLevel(level);
  if (v === "urgent_attention") return "Urgent attention";
  if (v === "priority_review") return "Priority review";
  if (v === "routine_review") return "Routine review";
  return "Home care / monitor";
}

function severityMargin(probabilities = {}) {
  const vals = Object.values(probabilities || {}).map((n) => Number(n)).filter(Number.isFinite);
  if (!vals.length) return null;
  const sorted = vals.sort((a, b) => b - a);
  return sorted.length >= 2 ? sorted[0] - sorted[1] : sorted[0];
}

function computeSeverityState(fusedResult = {}) {
  // If upstream provided a normalized severity display, respect it for patient-facing use.
  if (fusedResult.severity_display) {
    return {
      label: fusedResult.severity_display,
      isUncertain: String(fusedResult.severity_display).toLowerCase() === "uncertain",
      confidence: null,
      margin: null,
    };
  }

  const severityLabelRaw =
    fusedResult.final_severity_level ||
    fusedResult.severity_level ||
    fusedResult.severity ||
    fusedResult.risk_level ||
    fusedResult.fused_label ||
    fusedResult.ml_analysis?.predicted_class ||
    null;

  const severityConfidence =
    fusedResult.ml_analysis?.confidence ??
    fusedResult.severity_confidence ??
    fusedResult.final_severity_score ??
    fusedResult.severity_score ??
    null;

  const probMargin = severityMargin(
    fusedResult.ml_analysis?.all_probabilities || fusedResult.all_probabilities || fusedResult.severity_probabilities
  );

  const uncertain =
    fusedResult.ml_analysis?.severity_uncertain === true ||
    fusedResult.severity_uncertain === true ||
    (Number.isFinite(severityConfidence) && severityConfidence < 0.6) ||
    (Number.isFinite(probMargin) && probMargin < 0.1) ||
    !severityLabelRaw;

  const normalizedLabel = severityLabelRaw ? titleize(severityLabelRaw) : "Uncertain";

  return {
    label: uncertain ? "Uncertain" : normalizedLabel,
    isUncertain: uncertain,
    confidence: severityConfidence,
    margin: probMargin,
  };
}

function computeDiseaseState(finalAssessment = null, fusedResult = {}) {
  const existing = finalAssessment || fusedResult.final_disease_assessment;
  const confidenceScore =
    existing?.confidence_score ??
    existing?.confidence ??
    fusedResult.disease?.confidence ??
    fusedResult.confidence ??
    fusedResult.score ??
    null;
  const status = existing?.status || fusedResult.disease?.status || "uncertain";

  const confidentStatus = status === "confirmed" || status === "likely";
  const confident = (Number.isFinite(confidenceScore) && confidenceScore >= 0.7) || confidentStatus;

  const isUncertain = !confident;
  const conditionText = isUncertain
    ? "Condition unclear from image"
    : existing?.display_name || fusedResult.disease?.display_name || normalizeConditionName(fusedResult.predicted_class || fusedResult.label);

  return { conditionText: conditionText || "Condition unclear from image", isUncertain, confidenceScore, status };
}

function buildNormalizedDisplay({
  fusedResult = {},
  finalAssessment = null,
  recommendedActions = {},
  mlImageResult = {},
}) {
  const imageGate = fusedResult.image_gate || {};
  const imageGateFromImage = mlImageResult.image_gate || {};
  const gate = Object.keys(imageGateFromImage).length ? imageGateFromImage : imageGate;
  const isClearGate =
    String(gate.top_label || "").toLowerCase() === "clear_or_normal_skin" && Number(gate.top_score || 0) >= 0.85;

  const redFlags = Array.isArray(fusedResult.red_flags)
    ? fusedResult.red_flags
    : Array.isArray(fusedResult?.triage?.red_flags)
      ? fusedResult.triage.red_flags
      : [];

  const severityState = computeSeverityState(fusedResult);
  const diseaseState = computeDiseaseState(finalAssessment, fusedResult);

  const triageRaw = recommendedActions.care_level || fusedResult.triage_level || fusedResult.triage || fusedResult.risk_level;
  const triageLevel = mapTriageToCareLevel(triageRaw);
  const needsClinicianReview = recommendedActions.needs_clinician_review ?? fusedResult.needs_clinician_review ?? false;
  const hasUrgent = triageLevel === "urgent_attention" || redFlags.length > 0 || Boolean(recommendedActions.urgent_warning);

  const retakeRequired =
    recommendedActions.retake_required ||
    fusedResult?.image_gate?.quality?.retake_required ||
    fusedResult?.patient_guidance?.retake_required;

  let nextStepText =
    (Array.isArray(recommendedActions.items) && recommendedActions.items[0]) ||
    fusedResult.recommended_action ||
    fusedResult.recommendation ||
    null;

  if (isClearGate) {
    nextStepText = DEFAULT_MONITOR_TEXT;
  } else if (triageLevel === "home_care" && !hasUrgent && !needsClinicianReview) {
    if (!nextStepText || /immediate|urgent|emergency/i.test(String(nextStepText))) {
      nextStepText = DEFAULT_MONITOR_TEXT;
    }
  }

  if (!nextStepText) nextStepText = DEFAULT_MONITOR_TEXT;

  const imageAssessment = isClearGate
    ? "No obvious rash detected"
    : imageGate?.message || mlImageResult?.image_assessment_display || mlImageResult?.quality_note || "Image reviewed";

  const suppressionFlags = {
    imageSuppressed: mlImageResult.image_analysis_suppressed === true,
    suppressDisease: mlImageResult.should_suppress_disease_display === true,
    suppressSeverity: mlImageResult.should_suppress_hard_severity === true,
  };

  const suppressionContract =
    suppressionFlags.imageSuppressed ||
    (suppressionFlags.suppressDisease && suppressionFlags.suppressSeverity && isClearGate);

  const severityText =
    mlImageResult.severity_display ||
    (suppressionContract
      ? "Uncertain"
      : isClearGate
        ? "Uncertain"
        : severityState.label || "Uncertain");
  const showConditionSection = suppressionFlags.suppressDisease ? false : !(diseaseState.isUncertain || isClearGate);

  if (suppressionContract) {
    const suppressedSeverity = mlImageResult.severity_display || "Uncertain";
    const suppressedCondition = mlImageResult.disease_display || "Uncertain";
    const suppressionNextStep =
      hasUrgent &&
      ((Array.isArray(recommendedActions.items) && recommendedActions.items[0]) ||
        fusedResult.recommended_action ||
        fusedResult.recommendation)
        ? (Array.isArray(recommendedActions.items) && recommendedActions.items[0]) ||
          fusedResult.recommended_action ||
          fusedResult.recommendation
        : DEFAULT_MONITOR_TEXT;

    return {
      image_assessment: mlImageResult.image_assessment_display || imageAssessment,
      condition_text: suppressedCondition,
      severity_text: suppressedSeverity,
      next_step_text: suppressionNextStep,
      triage_text: careLabel(triageLevel),
      show_urgent_badge: hasUrgent,
      show_condition_section: suppressionFlags.suppressDisease ? false : showConditionSection,
      show_severity_section: true,
      is_low_confidence: true,
      retake_required: Boolean(retakeRequired),
    };
  }

  return {
    image_assessment: imageAssessment,
    condition_text: showConditionSection ? diseaseState.conditionText : "Uncertain",
    severity_text: severityText,
    next_step_text: nextStepText,
    triage_text: careLabel(triageLevel),
    show_urgent_badge: hasUrgent,
    show_condition_section: showConditionSection,
    show_severity_section: true,
    is_low_confidence: diseaseState.isUncertain || severityState.isUncertain || isClearGate || needsClinicianReview === true,
    retake_required: Boolean(retakeRequired),
  };
}

function emergencyContacts() {
  return withTelHref(US_EMERGENCY_CONTACTS);
}

function buildEmergencySupport({ fusedResult = {}, display = {}, recommendedActions = {} }) {
  const redFlags = Array.isArray(fusedResult.red_flags)
    ? fusedResult.red_flags
    : Array.isArray(fusedResult?.triage?.red_flags)
      ? fusedResult.triage.red_flags
      : [];

  const triageRaw = recommendedActions.care_level || fusedResult.triage_level || fusedResult.triage || fusedResult.risk_level;
  const triageLevel = mapTriageToCareLevel(triageRaw);
  const urgentWarning =
    recommendedActions.urgent_warning ||
    fusedResult?.patient_guidance?.urgent_warning ||
    fusedResult?.triage?.urgent_warning ||
    fusedResult.urgent_warning ||
    null;
  const isEmergency = triageLevel === "urgent_attention" || display.show_urgent_badge === true || redFlags.length > 0;

  const guidanceText =
    "This screening suggests the case may need immediate medical evaluation. Contact emergency services or go to the nearest hospital now if symptoms are severe or worsening.";
  const nextStepText =
    "Seek urgent medical attention now. Contact emergency services or go to the nearest hospital if symptoms are severe or worsening.";

  return {
    is_emergency: isEmergency,
    label: "Urgent care recommended",
    heading: "Seek immediate medical attention",
    guidance_text: guidanceText,
    warning_text: urgentWarning || "Urgent symptoms may need prompt in-person medical evaluation.",
    chat_text:
      "Your case may need urgent medical attention. Please contact emergency services or go to the nearest hospital immediately if symptoms are severe or worsening.",
    next_step_text: nextStepText,
    contacts: emergencyContacts(),
  };
}

function deriveAiFirstSupportState({ fusedResult = {}, mlImageResult = {} }) {
  const display = fusedResult.display || {};
  const recommended = fusedResult.recommended_actions || {};
  const imageGate = mlImageResult.image_gate || fusedResult.image_gate || {};
  const imageAssessment = String(
    display.image_assessment || mlImageResult.image_assessment_display || imageGate.message || ""
  ).toLowerCase();
  const topLabel = String(imageGate.top_label || "").toLowerCase();
  const topScore = Number(imageGate.top_score || 0);
  const qualityStatus = String(
    mlImageResult.quality || imageGate?.quality?.quality_status || fusedResult.quality_status || ""
  ).toLowerCase();

  const clearOrNormalSkin =
    (topLabel === "clear_or_normal_skin" && topScore >= 0.7) || imageAssessment.includes("no obvious rash");

  const retakeRequired =
    Boolean(display.retake_required ?? recommended.retake_required) ||
    imageAssessment.includes("clearer") ||
    imageAssessment.includes("poor quality") ||
    imageAssessment.includes("blur") ||
    ["low", "poor", "blurred", "unclear"].some((token) => qualityStatus.includes(token));

  if (clearOrNormalSkin) {
    return {
      state: "NO_OBVIOUS_RASH",
      prompt:
        "I could not identify an obvious rash in this photo. If your symptoms are still present but not visible here, please upload a clearer close-up in good lighting. If you want a human review anyway, you can request a doctor review at any time.",
      allowReupload: true,
      allowDoctorRequest: true,
      allowAiChat: true,
    };
  }

  if (retakeRequired) {
    return {
      state: "REUPLOAD_IMAGE",
      prompt:
        "This photo does not look clear enough for reliable AI screening. Please upload a sharper, well-lit close-up of the affected area. If you would rather have a human review, you can also request a doctor review.",
      allowReupload: true,
      allowDoctorRequest: true,
      allowAiChat: true,
    };
  }

  return {
    state: "AI_CHAT",
    prompt:
      "This screening suggests a possible skin issue, but it is still preliminary. You can continue the AI chat so I can ask focused follow-up questions, upload a better image if needed, or request a doctor review if AI support is not enough.",
    allowReupload: true,
    allowDoctorRequest: true,
    allowAiChat: true,
  };
}

function buildInitialAiGuidance({ fusedResult = {}, mlImageResult = {} }) {
  const support = deriveAiFirstSupportState({ fusedResult, mlImageResult });

  if (support.state === "NO_OBVIOUS_RASH") {
    return `${support.prompt} What symptoms are you feeling even if they are not obvious in the photo?`;
  }

  if (support.state === "REUPLOAD_IMAGE") {
    return `${support.prompt} If you continue in chat, tell me whether the area is itchy, painful, or spreading.`;
  }

  return `${support.prompt} Tell me whether the area is itchy, painful, spreading, or changing so I can guide the next step.`;
}

function geminiFirstConditionDisplay(fusedResult = {}, finalAssessment = null) {
  const fda = finalAssessment || fusedResult.final_disease_assessment;
  if (fda?.display_name && (!fda.source || fda.source === "gemini" || fda.source === "combined")) return fda.display_name;
  const geminiField = fusedResult.gemini_condition || fusedResult.visual_condition_hint || fusedResult.condition_name;
  if (geminiField) {
    const norm = normalizeConditionName(geminiField);
    if (norm && !SEVERITY_WORDS.has(norm.toLowerCase())) return norm;
  }
  if (fda?.display_name && !SEVERITY_WORDS.has(String(fda.display_name).toLowerCase())) return fda.display_name;
  return "Possible skin issue detected";
}

function deriveFinalDiseaseAssessment({ fusedResult = {}, mlImageResult = {}, mlReport = {} }) {
  const candidates = [];

  const pushCandidate = (label, source, confidence) => {
    const norm = normalizeConditionName(label);
    if (!norm || SEVERITY_WORDS.has(norm.toLowerCase())) return;
    candidates.push({
      display: String(label).trim(),
      norm,
      source,
      confidence: typeof confidence === "number" ? confidence : Number(confidence),
    });
  };

  const existing = fusedResult.final_disease_assessment;
  if (existing?.display_name) {
    pushCandidate(existing.display_name, existing.source || "combined", existing.confidence_score || existing.confidence_band);
  }

  const fusedName =
    fusedResult.final_condition ||
    fusedResult.final_disease ||
    fusedResult.disease ||
    fusedResult.predicted_condition ||
    fusedResult.predicted_class ||
    fusedResult.label;
  pushCandidate(fusedName, "ml", fusedResult.confidence ?? fusedResult.score ?? fusedResult.confidence_score);

  const imageName = mlImageResult.predicted_class || mlImageResult.label || mlImageResult.disease;
  pushCandidate(imageName, "ml", mlImageResult.confidence ?? mlImageResult.confidence_score ?? mlImageResult.score);

  const reportCondition = mlReport?.condition || mlReport?.gemini_condition || mlReport?.condition_prediction;
  if (typeof reportCondition === "string") pushCandidate(reportCondition, "gemini", mlReport?.confidence ?? 0.85);
  else if (reportCondition?.display_name || reportCondition?.name)
    pushCandidate(reportCondition.display_name || reportCondition.name, "gemini", reportCondition.confidence ?? mlReport?.confidence ?? 0.85);

  if (fusedResult.gemini_condition || fusedResult.visual_condition_hint)
    pushCandidate(fusedResult.gemini_condition || fusedResult.visual_condition_hint, "gemini", fusedResult.gemini_confidence ?? 0.9);

  if (!candidates.length) return null;

  candidates.sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0));
  const primary = candidates[0];
  const agreeWithPrimary = candidates.filter((c) => c.norm === primary.norm && c.source !== primary.source);
  const disagree = candidates.some((c) => c.norm !== primary.norm);

  let status = "uncertain";
  if (disagree) status = "ambiguous";
  else if ((primary.confidence ?? 0) >= 0.7) status = "likely";
  else if ((primary.confidence ?? 0) <= 0) status = "uncertain";

  const source = agreeWithPrimary.length ? "combined" : primary.source || "ml";

  return {
    display_name: primary.display,
    canonical_label: primary.norm,
    source,
    status: candidates.length ? status : "not_available",
    confidence_score: Number.isFinite(primary.confidence) ? primary.confidence : null,
    confidence_band: confidenceBandFromScore(primary.confidence),
    summary: `Possible ${primary.display} pattern detected. This is a preliminary AI screening, not a confirmed diagnosis.`,
  };
}

function deriveRecommendedActions({ fusedResult = {}, finalAssessment = null, mlImageResult = {} }) {
  const items = [];
  if (Array.isArray(fusedResult.recommended_actions)) items.push(...fusedResult.recommended_actions);
  if (typeof fusedResult.recommended_action === "string") items.push(fusedResult.recommended_action);
  if (typeof fusedResult.recommendation === "string") items.push(fusedResult.recommendation);
  if (typeof fusedResult.patient_guidance === "string") items.push(fusedResult.patient_guidance);
  if (typeof fusedResult.guidance === "string") items.push(fusedResult.guidance);

  const cleaned = Array.from(
    new Set(
      items
        .map((s) => (s === undefined || s === null ? "" : String(s).trim()))
        .filter(Boolean)
    )
  );

  const triageRaw = fusedResult.triage_level || fusedResult.triage || fusedResult.risk_level || fusedResult.fused_label;
  const careLevel = mapTriageToCareLevel(triageRaw);

  const retakeRequired = Boolean(
    fusedResult.retake_required ||
    fusedResult.require_retake ||
    fusedResult.image_quality === "LOW" ||
    fusedResult.quality_flag === "LOW" ||
    fusedResult.quality === "low" ||
    fusedResult.quality_status === "low" ||
    mlImageResult?.quality === "low"
  );

  let urgentWarning = fusedResult.urgent_warning || (Array.isArray(fusedResult.red_flags) ? fusedResult.red_flags.join("; ") : null);
  if (!urgentWarning && careLevel === "urgent_attention") {
    urgentWarning = "Seek urgent care if symptoms escalate, breathing difficulty, facial swelling, or fever occur.";
  }

  const needsReview = fusedResult.needs_clinician_review ?? ["routine_review", "priority_review", "urgent_attention"].includes(careLevel);

  return {
    care_level: careLevel,
    items: cleaned.length ? cleaned.slice(0, 4) : ["Monitor symptoms and follow clinician guidance."],
    retake_required: retakeRequired,
    needs_clinician_review: Boolean(needsReview),
    urgent_warning: urgentWarning || null,
  };
}

function buildAiSummaryText({ display = {}, finalAssessment, recommendedActions, fusedResult }) {
  const parts = [];
  const conditionFallback = geminiFirstConditionDisplay(fusedResult, finalAssessment);
  const condition =
    display?.show_condition_section === false
      ? "Condition unclear from image"
      : display?.condition_text || conditionFallback;

  parts.push("AI screening completed.");
  if (display?.severity_text) parts.push(`Severity: ${display.severity_text}.`);
  if (condition) parts.push(`Possible condition: ${condition}.`);

  const nextStep = display?.next_step_text || (Array.isArray(recommendedActions?.items) && recommendedActions.items[0]) || null;
  if (nextStep) parts.push(`Recommended next step: ${nextStep}`);

  const triage = mapTriageToCareLevel(recommendedActions?.care_level || fusedResult?.triage_level || fusedResult?.triage);
  if (triage) parts.push(`Triage level: ${triage.replace(/_/g, " ")}`);

  if (display?.show_urgent_badge && recommendedActions?.urgent_warning) {
    parts.push(`Urgent warning: ${recommendedActions.urgent_warning}`);
  }

  if (display?.retake_required || recommendedActions?.retake_required) {
    parts.push("Image quality may be limited; consider retaking a clearer photo.");
  }

  parts.push("This is not a confirmed diagnosis. Please seek clinician review for medical decisions.");

  return parts.join(" ");
}

function enrichFusedResult({ fusedResult = {}, mlImageResult = {}, mlReport = {} }) {
  const base = fusedResult && typeof fusedResult === "object" ? { ...fusedResult } : {};
  const finalAssessment = deriveFinalDiseaseAssessment({ fusedResult: base, mlImageResult, mlReport });
  const recommendedActions = deriveRecommendedActions({ fusedResult: base, finalAssessment, mlImageResult });
  let display = buildNormalizedDisplay({ fusedResult: base, finalAssessment, recommendedActions, mlImageResult });

  const redFlags = Array.isArray(base.red_flags)
    ? base.red_flags
    : Array.isArray(base?.triage?.red_flags)
      ? base.triage.red_flags
      : [];

  const triageRaw = recommendedActions.care_level || base.triage_level || base.triage || base.risk_level;
  const triageLevel = mapTriageToCareLevel(triageRaw);
  const needsClinicianReview = recommendedActions.needs_clinician_review ?? base.needs_clinician_review ?? false;
  const hasUrgent = triageLevel === "urgent_attention" || redFlags.length > 0 || Boolean(recommendedActions.urgent_warning);

  const imageGate = (mlImageResult && mlImageResult.image_gate) || base.image_gate || {};
  const isClearGate = String(imageGate.top_label || "").toLowerCase() === "clear_or_normal_skin" && Number(imageGate.top_score || 0) >= 0.9;

  const suppressionFlags = {
    imageSuppressed: mlImageResult.image_analysis_suppressed === true,
    suppressDisease: mlImageResult.should_suppress_disease_display === true,
    suppressSeverity: mlImageResult.should_suppress_hard_severity === true,
  };

  const suppressionContract =
    suppressionFlags.imageSuppressed ||
    (suppressionFlags.suppressDisease && suppressionFlags.suppressSeverity && isClearGate);

  const benignGateUncertain =
    isClearGate &&
    String(mlImageResult.severity_display || "").toLowerCase() === "uncertain" &&
    String(mlImageResult.disease_display || "").toLowerCase() === "uncertain";

  const benignGuard =
    (isClearGate && triageLevel === "home_care" && !hasUrgent && !needsClinicianReview) ||
    (suppressionContract && triageLevel === "home_care" && !hasUrgent && !needsClinicianReview) ||
    (benignGateUncertain && triageLevel === "home_care" && !hasUrgent && !needsClinicianReview);

  let severityLabel = display?.severity_text || base.final_severity_level || aiSeverityLabel(base);
  let recommended = { ...recommendedActions };

  if (benignGuard) {
    display = {
      ...display,
      severity_text: "Uncertain",
      show_urgent_badge: false,
      next_step_text: DEFAULT_MONITOR_TEXT,
      triage_text: display.triage_text || "Home care / monitor",
      show_condition_section: false,
      is_low_confidence: true,
    };
    severityLabel = "Uncertain";
    recommended = {
      ...recommended,
      care_level: "home_care",
      items: [DEFAULT_MONITOR_TEXT],
      urgent_warning: null,
      needs_clinician_review: false,
    };
    base.recommended_action = DEFAULT_MONITOR_TEXT;
  }

  // Ensure symptom-only severity does not override patient-facing severity in benign cases
  if (benignGuard && base.final_severity_level && base.final_severity_level.toLowerCase() !== "uncertain") {
    base.final_severity_level = "Uncertain";
  }
  if (display?.severity_text === "Uncertain") {
    base.final_severity_level = "Uncertain";
  }

  const emergencySupport = buildEmergencySupport({ fusedResult: base, display, recommendedActions: recommended });
  if (emergencySupport.is_emergency) {
    display = {
      ...display,
      next_step_text: emergencySupport.next_step_text,
      show_urgent_badge: true,
    };
    recommended = {
      ...recommended,
      items: [
        emergencySupport.next_step_text,
        ...((Array.isArray(recommended.items) ? recommended.items : []).filter(
          (item) => normalizeSummaryKeyPart(item) !== normalizeSummaryKeyPart(emergencySupport.next_step_text)
        )),
      ].slice(0, 4),
      urgent_warning: recommended.urgent_warning || emergencySupport.warning_text,
    };
  }

  const aiSummaryText = buildAiSummaryText({ display, finalAssessment, recommendedActions: recommended, fusedResult: base });
  const support = deriveAiFirstSupportState({ fusedResult: { ...base, display, recommended_actions: recommended }, mlImageResult });

  display = {
    ...display,
    emergency_support: emergencySupport,
    support_state: support.state,
    support_prompt: support.prompt,
    action_ctas: {
      reupload_image: support.allowReupload,
      request_doctor: support.allowDoctorRequest,
      continue_ai_chat: support.allowAiChat,
    },
  };

  const enriched = { ...base };
  if (severityLabel && !enriched.final_severity_level) enriched.final_severity_level = severityLabel;
  else if (benignGuard) enriched.final_severity_level = "Uncertain";
  enriched.final_disease_assessment = finalAssessment;
  enriched.recommended_actions = recommended;
  enriched.ai_summary_text = aiSummaryText;
  enriched.display = display;

  return { fusedResult: enriched, aiSummaryText, severityLabel, recommendedActions: recommended, finalAssessment, display };
}

async function ensureAiChatMessage({ caseId, fusedResult, submittedAt }) {
  if (!fusedResult) return;
  const cid = Number(caseId);
  const display = fusedResult.display || {};
  const severity = display.severity_text || fusedResult.final_severity_level || aiSeverityLabel(fusedResult);
  const finalAssessment = fusedResult.final_disease_assessment;
  const recommended = fusedResult.recommended_actions || {};
  const summaryText = fusedResult.ai_summary_text || fusedResult.aiSummary || null;
  const conditionDisplay =
    display.show_condition_section === false
      ? "Condition unclear from image"
      : display.condition_text || geminiFirstConditionDisplay(fusedResult, finalAssessment);
  const conditionLine = `Possible condition: ${conditionDisplay}`;
  const summaryOverride = summaryText
    ? summaryText.includes("Possible condition:")
      ? summaryText
      : `${conditionLine}\n${summaryText}`
    : null;

  const possibleCondition = conditionLine;
  const action =
    display.next_step_text ||
    (Array.isArray(recommended.items) && recommended.items[0]) ||
    fusedResult.recommended_action ||
    fusedResult.recommendation ||
    "Monitor and follow up.";
  const triage = recommended.care_level || fusedResult.triage_level || fusedResult.triage || null;
  const urgentWarning =
    display.show_urgent_badge === true ? recommended.urgent_warning || fusedResult.urgent_warning || null : null;
  const retakeLine = recommended.retake_required
    ? "Retake guidance: Image quality may be limited; please consider retaking clearer photos."
    : null;
  const summaryMessages = [
    ["AI Triage Summary (preliminary)", `Severity: ${severity}`, triage ? `Triage level: ${mapTriageToCareLevel(triage).replace(/_/g, " ")}` : null]
      .filter(Boolean)
      .join("\n"),
    possibleCondition,
    [`Recommended next step: ${action}`, "Preliminary AI screening only — not a confirmed diagnosis."].join("\n"),
  ];
  if (retakeLine) summaryMessages.push(retakeLine);
  if (urgentWarning) summaryMessages.push(`Urgent warning: ${urgentWarning}`);
  const structuredSummary = summaryMessages.join("\n\n");

  const convo = await prisma.caseConversation.upsert({
    where: { caseId: cid },
    update: {},
    create: { caseId: cid },
  });

  const existing = await prisma.caseMessage.findFirst({
    where: {
      conversationId: convo.id,
      messageType: "AI_SUMMARY",
    },
  });

  const baseMeta = {
    aiGenerated: true,
    source: "ML_FUSION",
    caseId: cid,
    final_severity_level: fusedResult.final_severity_level ?? severity,
    final_severity_score: fusedResult.final_severity_score ?? fusedResult.confidence ?? fusedResult.confidence_score ?? fusedResult.score ?? null,
    recommended_action: action,
    final_disease_assessment: finalAssessment || null,
    recommended_actions: recommended || null,
    ai_summary_text: summaryOverride || structuredSummary,
    display: display || null,
    updatedAt: new Date().toISOString(),
  };

  const caseSubmittedAt = submittedAt ? new Date(submittedAt) : null;
  const firstTimestamp = caseSubmittedAt ? new Date(caseSubmittedAt.getTime() - 1000) : new Date(Date.now() - 1000);

  if (existing) {
    await prisma.caseMessage.update({
      where: { id: existing.id },
      data: {
        content: structuredSummary,
        metaJson: { ...(existing.metaJson || {}), ...baseMeta },
      },
    });
    return;
  }

  await prisma.caseMessage.createMany({
    data: summaryMessages.map((msg, idx) => ({
      conversationId: convo.id,
      senderId: 0,
      senderRole: "SYSTEM",
      messageType: "AI_SUMMARY",
      tempId: null,
      type: "TEXT",
      content: msg,
      createdAt: new Date(firstTimestamp.getTime() + idx),
      metaJson: baseMeta,
    })),
  });
}

async function createSystemCaseMessage({
  db = prisma,
  caseId,
  content,
  messageType,
  meta = null,
  createdAt = new Date(),
}) {
  const cid = Number(caseId);
  const conversation = await db.caseConversation.upsert({
    where: { caseId: cid },
    update: {},
    create: { caseId: cid },
  });

  return db.caseMessage.create({
    data: {
      conversationId: conversation.id,
      senderId: SYSTEM_ACTOR_ID,
      senderRole: "SYSTEM",
      content,
      type: "TEXT",
      messageType,
      tempId: null,
      metaJson: meta || null,
      createdAt,
    },
  });
}

function hasDoctorReview(triageCase = {}) {
  return Boolean(
    triageCase.doctorReviewedAt ||
    triageCase.doctorNotes ||
    triageCase.doctorRecommendation ||
    triageCase.doctorSeverityOverride ||
    (triageCase.doctorFollowUpNeeded !== null && triageCase.doctorFollowUpNeeded !== undefined)
  );
}

function buildDoctorReviewMeta(triageCase = {}) {
  return {
    caseId: Number(triageCase.id),
    doctorReviewedAt: triageCase.doctorReviewedAt ? new Date(triageCase.doctorReviewedAt).toISOString() : null,
    doctorSeverityOverride: triageCase.doctorSeverityOverride || null,
    doctorFollowUpNeeded: triageCase.doctorFollowUpNeeded ?? null,
    doctorName: assignedDoctorDisplay(triageCase.assignedDoctor),
    doctorRecommendation: triageCase.doctorRecommendation || null,
    doctorNotes: triageCase.doctorNotes || null,
  };
}

function hasDoctorUrgentRecommendation(...values) {
  const text = values
    .filter((value) => typeof value === "string" && value.trim())
    .join(" ")
    .toLowerCase();

  if (!text) return false;

  return [
    /seek immediate medical attention/,
    /urgent care/,
    /go to (the )?(nearest )?(er|emergency room|hospital)/,
    /call 911/,
    /emergency services/,
    /go to the hospital now/,
    /\bimmediately\b/,
  ].some((pattern) => pattern.test(text));
}

function doctorCareLevel({ severityOverride = "", followUpNeeded = null, fallbackCareLevel = "", hasUrgentRecommendation = false } = {}) {
  const value = String(severityOverride || "").toLowerCase();
  if (value === "severe" || hasUrgentRecommendation) return "Urgent attention";
  if (value === "moderate" || followUpNeeded === true) return "Priority review";
  if (value === "mild") return "Home care / monitor";
  return fallbackCareLevel || "Home care / monitor";
}

function buildDoctorReviewMessagePayload(triageCase = {}) {
  const meta = buildDoctorReviewMeta(triageCase);
  const fused = triageCase.mlFusedResult || {};
  const display = fused.display || {};
  const recommended = fused.recommended_actions || {};
  const aiCareLevel = display.triage_text || careLabel(recommended.care_level || fused.triage_level || fused.triage);
  const hasUrgentRecommendation = hasDoctorUrgentRecommendation(meta.doctorRecommendation, meta.doctorNotes);
  const severity = meta.doctorSeverityOverride ? titleize(meta.doctorSeverityOverride) : null;
  const careLevel = doctorCareLevel({
    severityOverride: meta.doctorSeverityOverride,
    followUpNeeded: meta.doctorFollowUpNeeded,
    fallbackCareLevel: aiCareLevel,
    hasUrgentRecommendation,
  });
  const isEmergency = meta.doctorSeverityOverride === "severe" || hasUrgentRecommendation;

  const lines = ["A doctor reviewed your case and updated your care guidance."];
  if (severity) lines.push(`Current severity: ${severity}.`);
  if (careLevel) lines.push(`Care level: ${careLevel}.`);
  if (meta.doctorRecommendation) lines.push(`Recommendation: ${meta.doctorRecommendation}`);
  if (meta.doctorNotes) lines.push(`Notes: ${meta.doctorNotes}`);
  if (meta.doctorFollowUpNeeded !== null) {
    lines.push(`Follow-up needed: ${meta.doctorFollowUpNeeded ? "Yes" : "No"}.`);
  }
  if (isEmergency) {
    lines.push("Seek urgent medical attention now if symptoms are severe or worsening.");
  }

  return {
    content: lines.join("\n"),
    meta: {
      ...meta,
      careLevel,
      isEmergency,
      source: "DOCTOR_REVIEW",
      updatedAt: new Date().toISOString(),
    },
  };
}

async function ensureDoctorReviewSystemMessage({ caseId, triageCase }) {
  if (!hasDoctorReview(triageCase)) return null;

  const conversation = await prisma.caseConversation.upsert({
    where: { caseId: Number(caseId) },
    update: {},
    create: { caseId: Number(caseId) },
  });

  const existing = await prisma.caseMessage.findFirst({
    where: {
      conversationId: conversation.id,
      messageType: "DOCTOR_REVIEWED",
    },
    orderBy: { id: "asc" },
  });

  const payload = buildDoctorReviewMessagePayload(triageCase);
  const { content, meta } = payload;

  if (existing) {
    await prisma.caseMessage.update({
      where: { id: existing.id },
      data: {
        content,
        metaJson: {
          ...(existing.metaJson || {}),
          ...meta,
        },
      },
    });
    return existing;
  }

  return createSystemCaseMessage({
    caseId: Number(caseId),
    messageType: "DOCTOR_REVIEWED",
    content,
    meta: {
      ...meta,
      createdAt: new Date().toISOString(),
    },
  });
}

function activeCaseImageUrl(triageCase = {}) {
  if (Array.isArray(triageCase.imageUrls) && triageCase.imageUrls.length) return triageCase.imageUrls[0];
  if (Array.isArray(triageCase.images) && triageCase.images.length) {
    const latestImage = [...triageCase.images].sort(
      (a, b) => new Date(b.uploadedAt || 0).getTime() - new Date(a.uploadedAt || 0).getTime()
    )[0];
    return latestImage?.imageUrl || null;
  }
  return null;
}

function normalizeSummaryKeyPart(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .slice(0, 180);
}

function buildAutoAiSupportMessage({ triageCase, fusedResult }) {
  if (!fusedResult) return null;

  const display = fusedResult.display || {};
  const recommended = fusedResult.recommended_actions || {};
  const emergencySupport = display.emergency_support || buildEmergencySupport({ fusedResult, display, recommendedActions: recommended });
  const support = deriveAiFirstSupportState({
    fusedResult,
    mlImageResult: triageCase?.mlImageResult || {},
  });

  const supportState = display.support_state || support.state || "AI_CHAT";
  const imageAssessment = display.image_assessment || "Image reviewed";
  const condition =
    display.show_condition_section === false
      ? "The image is still not specific enough to name a clear condition."
      : display.condition_text || geminiFirstConditionDisplay(fusedResult, fusedResult.final_disease_assessment);
  const severity = display.severity_text || fusedResult.final_severity_level || aiSeverityLabel(fusedResult);
  const nextStep =
    display.next_step_text ||
    (Array.isArray(recommended.items) && recommended.items[0]) ||
    fusedResult.recommended_action ||
    fusedResult.recommendation ||
    "Continue the chat so AI support can guide the next step.";
  const urgentWarning =
    display.show_urgent_badge === true ? recommended.urgent_warning || fusedResult.urgent_warning || null : null;
  const triageText = display.triage_text || careLabel(recommended.care_level || fusedResult.triage_level || fusedResult.triage);
  const imageUrl = activeCaseImageUrl(triageCase);
  const emergencyContactsLine = Array.isArray(emergencySupport.contacts)
    ? emergencySupport.contacts.map((contact) => `${contact.label}: ${contact.number}`).join(" · ")
    : null;

  let bullets = [];
  if (emergencySupport.is_emergency) {
    bullets = [
      "Your case may need urgent medical attention.",
      emergencySupport.chat_text,
      emergencyContactsLine ? `Emergency contacts: ${emergencyContactsLine}.` : "Contact emergency services or the nearest hospital now.",
    ];
  } else if (supportState === "NO_OBVIOUS_RASH") {
    bullets = [
      "I could not identify an obvious rash in this photo.",
      "If your symptoms are still present, upload a clearer close-up in good lighting.",
      "You can keep chatting here or request a doctor review if you want human review.",
    ];
  } else if (supportState === "REUPLOAD_IMAGE") {
    bullets = [
      "This image looks too unclear for a reliable screen.",
      "Please upload a sharper, well-lit close-up of the affected area.",
      "If you prefer, you can also request a doctor review now.",
    ];
  } else {
    bullets = [
      `The image suggests a possible skin concern: ${condition}.`,
      `Current severity estimate: ${severity}.`,
      nextStep,
    ];
  }

  return {
    content: bullets.map((line) => `- ${line}`).join("\n"),
    meta: {
      aiGenerated: true,
      source: "ML_AUTOSUMMARY",
      supportState,
      imageAssessment,
      condition,
      severity,
      triageText,
      activeImageUrl: imageUrl,
      summaryKey: [
        normalizeSummaryKeyPart(imageUrl || `case-${triageCase?.id || ""}`),
        normalizeSummaryKeyPart(supportState),
        normalizeSummaryKeyPart(imageAssessment),
        normalizeSummaryKeyPart(condition),
        normalizeSummaryKeyPart(severity),
        normalizeSummaryKeyPart(triageText),
        normalizeSummaryKeyPart(nextStep),
        normalizeSummaryKeyPart(urgentWarning),
      ].join("|"),
    },
  };
}

async function ensureAutoAiSupportMessage({ caseId, triageCase, fusedResult }) {
  if (!fusedResult) return null;
  if (String(triageCase?.mlStatus || "").toUpperCase() !== "COMPLETED") return null;

  const payload = buildAutoAiSupportMessage({ triageCase, fusedResult });
  if (!payload?.content || !payload?.meta?.summaryKey) return null;

  const conversation = await prisma.caseConversation.upsert({
    where: { caseId: Number(caseId) },
    update: {},
    create: { caseId: Number(caseId) },
  });

  const recentSupportMessages = await prisma.caseMessage.findMany({
    where: {
      conversationId: conversation.id,
      messageType: "AI_SUPPORT",
    },
    orderBy: { id: "desc" },
    take: 12,
  });

  const duplicate = recentSupportMessages.find(
    (message) => String(message.metaJson?.summaryKey || "") === payload.meta.summaryKey
  );
  if (duplicate) return duplicate;

  return createSystemCaseMessage({
    caseId: Number(caseId),
    content: payload.content,
    messageType: "AI_SUPPORT",
    meta: {
      ...payload.meta,
      caseId: Number(caseId),
      generatedAt: new Date().toISOString(),
    },
  });
}

async function syncCaseImageRecords({ db = prisma, caseId, imageUrls = [] }) {
  if (!imageUrls.length) return;

  const existingRows = await db.caseImage.findMany({
    where: { caseId, imageUrl: { in: imageUrls } },
    select: { imageUrl: true },
  });
  const existingSet = new Set(existingRows.map((row) => row.imageUrl));
  const toCreate = imageUrls.filter((url) => !existingSet.has(url));

  if (toCreate.length) {
    await db.caseImage.createMany({
      data: toCreate.map((url) => ({ caseId, imageUrl: url })),
      skipDuplicates: true,
    });
  }
}

async function ensureAiChatMessage({ caseId, fusedResult, submittedAt }) {
  if (!fusedResult) return;
  const cid = Number(caseId);
  const display = fusedResult.display || {};
  const severity = display.severity_text || fusedResult.final_severity_level || aiSeverityLabel(fusedResult);
  const finalAssessment = fusedResult.final_disease_assessment;
  const recommended = fusedResult.recommended_actions || {};
  const conditionDisplay =
    display.show_condition_section === false
      ? "Condition unclear from image"
      : display.condition_text || geminiFirstConditionDisplay(fusedResult, finalAssessment);
  const action =
    display.next_step_text ||
    (Array.isArray(recommended.items) && recommended.items[0]) ||
    fusedResult.recommended_action ||
    fusedResult.recommendation ||
    "Monitor and follow up.";
  const triage = recommended.care_level || fusedResult.triage_level || fusedResult.triage || null;
  const urgentWarning =
    display.show_urgent_badge === true ? recommended.urgent_warning || fusedResult.urgent_warning || null : null;
  const guidanceText = display.support_prompt || buildInitialAiGuidance({ fusedResult });

  const summaryLines = [
    "AI Support Summary (preliminary)",
    display.image_assessment ? `Image assessment: ${display.image_assessment}` : null,
    `Possible condition: ${conditionDisplay}`,
    `Severity: ${severity}`,
    triage ? `Triage level: ${mapTriageToCareLevel(triage).replace(/_/g, " ")}` : null,
    `Recommended next step: ${action}`,
    "This is preliminary AI screening only and not a confirmed diagnosis.",
  ].filter(Boolean);

  if (display.retake_required || recommended.retake_required) {
    summaryLines.push("A clearer, closer, well-lit image may improve the review.");
  }
  if (urgentWarning) {
    summaryLines.push(`Urgent warning: ${urgentWarning}`);
  }

  const summaryContent = summaryLines.join("\n");
  const baseMeta = {
    aiGenerated: true,
    source: "ML_FUSION",
    caseId: cid,
    final_severity_level: fusedResult.final_severity_level ?? severity,
    final_severity_score:
      fusedResult.final_severity_score ?? fusedResult.confidence ?? fusedResult.confidence_score ?? fusedResult.score ?? null,
    recommended_action: action,
    final_disease_assessment: finalAssessment || null,
    recommended_actions: recommended || null,
    ai_summary_text: fusedResult.ai_summary_text || summaryContent,
    display: display || null,
    updatedAt: new Date().toISOString(),
  };

  const conversation = await prisma.caseConversation.upsert({
    where: { caseId: cid },
    update: {},
    create: { caseId: cid },
  });

  const existingMessages = await prisma.caseMessage.findMany({
    where: {
      conversationId: conversation.id,
      messageType: { in: ["AI_SUMMARY", "AI_GUIDANCE"] },
    },
    orderBy: { id: "asc" },
  });

  const summaryMessage = existingMessages.find((message) => message.messageType === "AI_SUMMARY");
  const guidanceMessage = existingMessages.find((message) => message.messageType === "AI_GUIDANCE");
  const duplicateIds = existingMessages
    .filter((message) => {
      if (message.messageType === "AI_SUMMARY" && summaryMessage && message.id !== summaryMessage.id) return true;
      if (message.messageType === "AI_GUIDANCE" && guidanceMessage && message.id !== guidanceMessage.id) return true;
      return false;
    })
    .map((message) => message.id);

  const caseSubmittedAt = submittedAt ? new Date(submittedAt) : null;
  const summaryTimestamp = caseSubmittedAt ? new Date(caseSubmittedAt.getTime() - 1000) : new Date(Date.now() - 1000);
  const guidanceTimestamp = new Date(summaryTimestamp.getTime() + 1);

  if (summaryMessage) {
    await prisma.caseMessage.update({
      where: { id: summaryMessage.id },
      data: {
        content: summaryContent,
        metaJson: { ...(summaryMessage.metaJson || {}), ...baseMeta },
      },
    });
  } else {
    await createSystemCaseMessage({
      caseId: cid,
      content: summaryContent,
      messageType: "AI_SUMMARY",
      meta: baseMeta,
      createdAt: summaryTimestamp,
    });
  }

  if (guidanceMessage) {
    await prisma.caseMessage.update({
      where: { id: guidanceMessage.id },
      data: {
        content: guidanceText,
        metaJson: { ...(guidanceMessage.metaJson || {}), ...baseMeta },
      },
    });
  } else {
    await createSystemCaseMessage({
      caseId: cid,
      content: guidanceText,
      messageType: "AI_GUIDANCE",
      meta: baseMeta,
      createdAt: guidanceTimestamp,
    });
  }

  if (duplicateIds.length) {
    await prisma.caseMessage.deleteMany({ where: { id: { in: duplicateIds } } });
  }
}

async function createCase({
  userId,
  title,
  duration,
  durationDays,
  durationLabel,
  medications,
  isEmergency,
  description, // kept for backward compatibility (not persisted yet)
  rashLocation,
  symptoms,
  severity,
  itchiness,
  spreadingStatus,
  triggers,
  imageUrls,
  mlImageResult,
  mlSymptomsResult,
  mlFusedResult,
  mlReport,
} = {}) {
  const uid = Number(userId);
  if (!Number.isFinite(uid)) {
    throw new ApiError(401, "Not authenticated");
  }

  const normalizedTitle = typeof title === "string" ? title.trim() : "";
  if (normalizedTitle.length < 3) {
    throw new ApiError(400, "Title is required");
  }

  const enrichedFused = mlFusedResult
    ? enrichFusedResult({ fusedResult: mlFusedResult, mlImageResult: mlImageResult || {}, mlReport: mlReport || {} })
    : null;
  const fusedToPersist = enrichedFused?.fusedResult || mlFusedResult || null;

  const triageCase = await prisma.$transaction(async (tx) => {
    // Audited flow before this refactor:
    // 1. patient case + intake were created here
    // 2. ML outputs were persisted on the same case
    // 3. the case was auto-assigned to a doctor immediately after create
    // The refactor keeps the ML/chat bootstrap, but leaves new cases in AI-first mode until the patient explicitly requests a doctor.
    // Ensure user has patient profile (role-based)
    const patient = await tx.patientProfile.findUnique({
      where: { patientId: uid },
      select: { patientId: true },
    });
    if (!patient) throw new ApiError(403, "Only PATIENT can create cases (patient profile missing)");

    // Normalize duration
    const durationValue =
      duration !== undefined
        ? String(duration)
        : durationDays !== undefined && durationDays !== null
          ? String(durationDays)
          : null;

    // Create intake (questionnaire answers)
    const intake = await tx.caseIntake.create({
      data: {
        title: normalizedTitle,
        isActive: true,
        duration: durationValue,
        medications: medications || null,
      },
      select: { id: true },
    });

    // Create triage case referencing patient + intake
    const createdCase = await tx.triageCase.create({
      data: {
        patientId: patient.patientId,
        intakeId: intake.id,
        isEmergency: Boolean(isEmergency),
        status: "SUBMITTED",
        rashLocation: rashLocation || null,
        durationLabel: durationLabel || null,
        symptoms: normalizeSymptomsPayload(symptoms),
        severity: severity ?? null,
        itchiness: itchiness ?? null,
        spreadingStatus: spreadingStatus || null,
        triggers: triggers || null,
        imageUrls: imageUrls?.length ? imageUrls : null,
        mlImageResult: mlImageResult ?? null,
        mlSymptomsResult: mlSymptomsResult ?? null,
        mlFusedResult: fusedToPersist,
        mlReport: mlReport ?? null,
        // if you kept an optional description field in your schema, map here
      },
      include: CASE_DETAILS_INCLUDE,
    });

    // Optional: audit log
    await tx.auditLog
      .create({
        data: {
          actorId: uid,
          action: "CASE_CREATED",
          targetTable: "Triage_Case",
          targetId: createdCase.id,
          metaJson: JSON.stringify({ title: normalizedTitle }),
        },
      })
      .catch(() => {});

    return createdCase;
  });

  return triageCase;
}

async function listCasesForUser({ userId, role }) {
  const uid = Number(userId);
  if (!Number.isFinite(uid) || !role) {
    throw new ApiError(401, "Not authenticated");
  }

  let cases;

  if (role === "PATIENT") {
    cases = await prisma.triageCase.findMany({
      where: { patientId: uid },
      orderBy: { submittedAt: "desc" },
      include: {
        intake: true,
        result: true,
        assignedDoctor: { include: { user: { select: { email: true } } } },
      },
    });
  } else if (role === "DOCTOR") {
    cases = await prisma.triageCase.findMany({
      where: { assignedDoctorId: uid },
      orderBy: { submittedAt: "desc" },
      include: {
        intake: true,
        result: true,
        patient: true,
        assignedDoctor: { include: { user: { select: { email: true } } } },
      },
    });
  } else {
    // ADMIN sees all
    cases = await prisma.triageCase.findMany({
      orderBy: { submittedAt: "desc" },
      include: {
        intake: true,
        result: true,
        patient: true,
        assignedDoctor: { include: { user: { select: { email: true } } } },
      },
    });
  }

  return [...cases]
    .sort((a, b) => new Date(b.submittedAt || 0) - new Date(a.submittedAt || 0))
    .map((triageCase) => {
      if (!triageCase?.mlFusedResult) return triageCase;

      try {
        const { fusedResult } = enrichFusedResult({
          fusedResult: triageCase.mlFusedResult,
          mlImageResult: triageCase.mlImageResult || {},
          mlReport: triageCase.mlReport || {},
        });
        return { ...triageCase, mlFusedResult: fusedResult };
      } catch (_) {
        return triageCase;
      }
    });
}

async function getCaseById({ userId, role, caseId }) {
  const uid = Number(userId);
  const cid = Number(caseId);

  const triageCase = await prisma.triageCase.findUnique({
    where: { id: cid },
    include: CASE_DETAILS_INCLUDE,
  });

  if (!triageCase) throw new ApiError(404, "Case not found");

  // Access control:
  if (role === "PATIENT" && triageCase.patientId !== uid) throw new ApiError(403, "Forbidden");
  if (role === "DOCTOR" && triageCase.assignedDoctorId !== uid) throw new ApiError(403, "Forbidden");
  // ADMIN allowed

  if (triageCase.mlFusedResult) {
    try {
      const { fusedResult } = enrichFusedResult({
        fusedResult: triageCase.mlFusedResult,
        mlImageResult: triageCase.mlImageResult || {},
        mlReport: triageCase.mlReport || {},
      });
      triageCase.mlFusedResult = fusedResult;
    } catch (_) {
      // Leave raw fused result intact if normalization fails
    }
  }

  return triageCase;
}

function assignedDoctorDisplay(assignedDoctor) {
  if (!assignedDoctor) return "a doctor";
  const fullName = [assignedDoctor.firstName, assignedDoctor.lastName].filter(Boolean).join(" ").trim();
  return fullName ? `Dr. ${fullName}` : assignedDoctor.user?.email || "a doctor";
}

async function applyDoctorAssignment({
  db = prisma,
  actorId,
  caseId,
  doctorId,
  auditAction = "CASE_ASSIGNED_DOCTOR",
  systemMessageType = "DOCTOR_ASSIGNED",
}) {
  const cid = Number(caseId);
  const did = Number(doctorId);

  const updated = await db.triageCase.update({
    where: { id: cid },
    data: {
      assignedDoctorId: did,
      status: "IN_REVIEW",
    },
    include: CASE_DETAILS_INCLUDE,
  });

  const doctorLabel = assignedDoctorDisplay(updated.assignedDoctor);
  const systemMessage = await createSystemCaseMessage({
    db,
    caseId: cid,
    messageType: systemMessageType,
    content: "A doctor has been assigned and will review your case shortly.",
    meta: {
      caseId: cid,
      assignedDoctorId: did,
      assignedDoctorName: doctorLabel,
    },
  });

  await db.auditLog.create({
    data: {
      actorId: Number(actorId),
      action: auditAction,
      targetTable: "Triage_Case",
      targetId: cid,
      metaJson: JSON.stringify({ assignedDoctorId: did }),
    },
  }).catch(() => {});

  return { triageCase: updated, systemMessage };
}

async function assignDoctor({ actorId, caseId, doctorId }) {
  const aid = Number(actorId);
  const cid = Number(caseId);
  const did = Number(doctorId);

  const triageCase = await prisma.triageCase.findUnique({ where: { id: cid } });
  if (!triageCase) throw new ApiError(404, "Case not found");

  const doctor = await prisma.doctorProfile.findUnique({
    where: { doctorId: did },
    select: { doctorId: true },
  });
  if (!doctor) throw new ApiError(404, "Doctor profile not found");

  const result = await applyDoctorAssignment({
    actorId: aid,
    caseId: cid,
    doctorId: did,
    auditAction: "CASE_ASSIGNED_DOCTOR",
    systemMessageType: "DOCTOR_ASSIGNED",
  });

  return result.triageCase;
}

async function requestDoctorAssignment({ actorId, role, caseId }) {
  const aid = Number(actorId);
  const cid = Number(caseId);

  const triageCase = await prisma.triageCase.findUnique({
    where: { id: cid },
    include: CASE_DETAILS_INCLUDE,
  });
  if (!triageCase) throw new ApiError(404, "Case not found");
  if (role !== "PATIENT" || triageCase.patientId !== aid) throw new ApiError(403, "Forbidden");

  if (triageCase.assignedDoctorId) {
    return {
      assigned: true,
      alreadyAssigned: true,
      case: triageCase,
      systemMessage: null,
    };
  }

  const doctorId = await pickDoctorForAutoAssign(prisma);
  if (!doctorId) {
    const systemMessage = await createSystemCaseMessage({
      caseId: cid,
      messageType: "DOCTOR_ASSIGNMENT_UNAVAILABLE",
      content:
        "Doctor review was requested, but no doctor is currently available. You can continue with AI support and try requesting a doctor review again shortly.",
      meta: { caseId: cid },
    });

    await prisma.auditLog.create({
      data: {
        actorId: aid,
        action: "CASE_DOCTOR_REQUESTED_UNAVAILABLE",
        targetTable: "Triage_Case",
        targetId: cid,
      },
    }).catch(() => {});

    return {
      assigned: false,
      alreadyAssigned: false,
      case: triageCase,
      systemMessage,
    };
  }

  const result = await applyDoctorAssignment({
    actorId: aid,
    caseId: cid,
    doctorId,
    auditAction: "CASE_DOCTOR_REQUESTED",
    systemMessageType: "DOCTOR_ASSIGNED",
  });

  return {
    assigned: true,
    alreadyAssigned: false,
    case: result.triageCase,
    systemMessage: result.systemMessage,
  };
}

async function deleteCase({ caseId, userId, role }) {
  const cid = Number(caseId);
  const uid = Number(userId);

  const triageCase = await prisma.triageCase.findUnique({
    where: { id: cid },
    include: { intake: true },
  });
  if (!triageCase) throw new ApiError(404, "Case not found");

  if (role === "PATIENT" && triageCase.patientId !== uid) throw new ApiError(403, "Forbidden");
  if (role === "DOCTOR") throw new ApiError(403, "Forbidden");

  await prisma.$transaction(async (tx) => {
    await tx.triageCase.delete({ where: { id: cid } });
    await tx.caseIntake.delete({ where: { id: triageCase.intakeId } });
  });

  await prisma.auditLog
    .create({
      data: {
        actorId: uid,
        action: "CASE_DELETED",
        targetTable: "Triage_Case",
        targetId: cid,
      },
    })
    .catch(() => {});

  return { id: cid };
}

async function updateCase({ caseId, userId, role, patch }) {
  const cid = Number(caseId);
  const uid = Number(userId);

  const triageCase = await prisma.triageCase.findUnique({
    where: { id: cid },
    include: { intake: true, patient: true, assignedDoctor: true, result: true },
  });
  if (!triageCase) throw new ApiError(404, "Case not found");

  let allowedFields = [];

  if (role === "ADMIN") {
    allowedFields = [
      "title",
      "duration",
      "durationDays",
      "durationLabel",
      "medications",
      "description",
      "isEmergency",
      "status",
      "rashLocation",
      "symptoms",
      "severity",
      "itchiness",
      "spreadingStatus",
      "triggers",
      "imageUrls",
      "mlImageResult",
      "mlSymptomsResult",
      "mlFusedResult",
      "mlReport",
    ];
  } else if (role === "PATIENT") {
    if (triageCase.patientId !== uid) throw new ApiError(403, "Forbidden");
    allowedFields = [
      "title",
      "duration",
      "durationDays",
      "durationLabel",
      "medications",
      "description",
      "isEmergency",
      "rashLocation",
      "symptoms",
      "severity",
      "itchiness",
      "spreadingStatus",
      "triggers",
      "imageUrls",
    ];
  } else if (role === "DOCTOR") {
    if (triageCase.assignedDoctorId !== uid) throw new ApiError(403, "Forbidden");
    allowedFields = ["status", "mlImageResult", "mlSymptomsResult", "mlFusedResult", "mlReport"];
  } else {
    throw new ApiError(403, "Forbidden");
  }

  const invalidField = Object.keys(patch).find((field) => !allowedFields.includes(field));
  if (invalidField) throw new ApiError(403, "Forbidden");

  const intakeUpdate = {};
  const caseUpdate = {};

  if (patch.title !== undefined) intakeUpdate.title = patch.title;
  if (patch.duration !== undefined) intakeUpdate.duration = patch.duration === null ? null : String(patch.duration);
  else if (patch.durationDays !== undefined) intakeUpdate.duration = patch.durationDays === null ? null : String(patch.durationDays);
  if (patch.medications !== undefined) intakeUpdate.medications = patch.medications ?? null;
  if (patch.isEmergency !== undefined) caseUpdate.isEmergency = patch.isEmergency;
  if (patch.status !== undefined) caseUpdate.status = patch.status;
  if (patch.durationLabel !== undefined) caseUpdate.durationLabel = patch.durationLabel ?? null;
  if (patch.rashLocation !== undefined) caseUpdate.rashLocation = patch.rashLocation ?? null;
  if (patch.symptoms !== undefined) caseUpdate.symptoms = patch.symptoms === null ? null : normalizeSymptomsPayload(patch.symptoms);
  if (patch.severity !== undefined) caseUpdate.severity = patch.severity ?? null;
  if (patch.itchiness !== undefined) caseUpdate.itchiness = patch.itchiness ?? null;
  if (patch.spreadingStatus !== undefined) caseUpdate.spreadingStatus = patch.spreadingStatus ?? null;
  if (patch.triggers !== undefined) caseUpdate.triggers = patch.triggers ?? null;
  if (patch.imageUrls !== undefined) caseUpdate.imageUrls = patch.imageUrls ?? null;
  if (patch.mlImageResult !== undefined) caseUpdate.mlImageResult = patch.mlImageResult ?? null;
  if (patch.mlSymptomsResult !== undefined) caseUpdate.mlSymptomsResult = patch.mlSymptomsResult ?? null;
  if (patch.mlFusedResult !== undefined) caseUpdate.mlFusedResult = patch.mlFusedResult ?? null;
  if (patch.mlReport !== undefined) caseUpdate.mlReport = patch.mlReport ?? null;

  const updatedCase = await prisma.$transaction(async (tx) => {
    if (Object.keys(intakeUpdate).length) {
      await tx.caseIntake.update({ where: { id: triageCase.intakeId }, data: intakeUpdate });
    }

    if (Object.keys(caseUpdate).length) {
      return tx.triageCase.update({
        where: { id: cid },
        data: caseUpdate,
        include: { intake: true, result: true, patient: true, assignedDoctor: true },
      });
    }

    // Only intake updated; re-read case with updated intake
    return tx.triageCase.findUnique({
      where: { id: cid },
      include: { intake: true, result: true, patient: true, assignedDoctor: true },
    });
  });

  await prisma.auditLog
    .create({
      data: {
        actorId: uid,
        action: "CASE_UPDATED",
        targetTable: "Triage_Case",
        targetId: cid,
        metaJson: JSON.stringify({ fields: Object.keys(patch) }),
      },
    })
    .catch(() => {});

  return updatedCase;
}

async function saveDoctorReview({ caseId, userId, role, review }) {
  const cid = Number(caseId);
  const uid = Number(userId);

  if (role !== "DOCTOR") throw new ApiError(403, "Forbidden");

  const triageCase = await prisma.triageCase.findUnique({
    where: { id: cid },
    include: CASE_DETAILS_INCLUDE,
  });
  if (!triageCase) throw new ApiError(404, "Case not found");
  if (triageCase.assignedDoctorId !== uid) throw new ApiError(403, "Forbidden");

  const doctorNotes =
    review.doctorNotes === undefined ? undefined : review.doctorNotes ? String(review.doctorNotes).trim() : null;
  const doctorRecommendation =
    review.doctorRecommendation === undefined
      ? undefined
      : review.doctorRecommendation
        ? String(review.doctorRecommendation).trim()
        : null;
  const doctorSeverityOverride =
    review.doctorSeverityOverride === undefined
      ? undefined
      : review.doctorSeverityOverride
        ? String(review.doctorSeverityOverride).trim().toLowerCase()
        : null;
  const doctorFollowUpNeeded =
    review.doctorFollowUpNeeded === undefined ? undefined : Boolean(review.doctorFollowUpNeeded);

  const updated = await prisma.$transaction(async (tx) => {
    const updatedCase = await tx.triageCase.update({
      where: { id: cid },
      data: {
        ...(doctorNotes !== undefined ? { doctorNotes } : {}),
        ...(doctorRecommendation !== undefined ? { doctorRecommendation } : {}),
        ...(doctorSeverityOverride !== undefined ? { doctorSeverityOverride } : {}),
        ...(doctorFollowUpNeeded !== undefined ? { doctorFollowUpNeeded } : {}),
        doctorReviewedAt: new Date(),
        status: triageCase.status === "CLOSED" ? "CLOSED" : "IN_REVIEW",
      },
      include: CASE_DETAILS_INCLUDE,
    });

    await tx.auditLog.create({
      data: {
        actorId: uid,
        action: "CASE_DOCTOR_REVIEW_SAVED",
        targetTable: "Triage_Case",
        targetId: cid,
        metaJson: JSON.stringify({
          fields: Object.keys(review || {}),
          doctorSeverityOverride: doctorSeverityOverride ?? null,
          doctorFollowUpNeeded: doctorFollowUpNeeded ?? null,
        }),
      },
    }).catch(() => {});

    return updatedCase;
  });

  const systemMessage = await ensureDoctorReviewSystemMessage({
    caseId: cid,
    triageCase: updated,
  }).catch(() => null);

  return {
    case: updated,
    systemMessage,
  };
}

async function addCaseImages({ caseId, userId, role, imageUrls }) {
  const cid = Number(caseId);
  const uid = Number(userId);

  const triageCase = await prisma.triageCase.findUnique({
    where: { id: cid },
    include: CASE_DETAILS_INCLUDE,
  });
  if (!triageCase) throw new ApiError(404, "Case not found");

  if (role === "PATIENT" && triageCase.patientId !== uid) throw new ApiError(403, "Forbidden");
  if (role === "DOCTOR" && triageCase.assignedDoctorId !== uid) throw new ApiError(403, "Forbidden");

  const existingUrls = Array.isArray(triageCase.imageUrls) ? triageCase.imageUrls : [];
  const merged = Array.from(new Set([...(existingUrls || []), ...(imageUrls || [])]));

  const updated = await prisma.$transaction(async (tx) => {
    const updatedCase = await tx.triageCase.update({
      where: { id: cid },
      data: { imageUrls: merged },
      include: CASE_DETAILS_INCLUDE,
    });
    await syncCaseImageRecords({ db: tx, caseId: cid, imageUrls });

    return updatedCase;
  });

  await prisma.auditLog
    .create({
      data: {
        actorId: uid,
        action: "CASE_IMAGES_ATTACHED",
        targetTable: "Triage_Case",
        targetId: cid,
        metaJson: JSON.stringify({ added: imageUrls?.length || 0 }),
      },
    })
    .catch(() => {});

  return updated;
}

async function replaceCaseImage({ caseId, userId, role, imageUrls }) {
  const cid = Number(caseId);
  const uid = Number(userId);

  const triageCase = await prisma.triageCase.findUnique({
    where: { id: cid },
    include: CASE_DETAILS_INCLUDE,
  });
  if (!triageCase) throw new ApiError(404, "Case not found");
  if (role !== "PATIENT" || triageCase.patientId !== uid) throw new ApiError(403, "Forbidden");

  const updated = await prisma.$transaction(async (tx) => {
    const updatedCase = await tx.triageCase.update({
      where: { id: cid },
      data: {
        imageUrls,
        mlImageResult: null,
        mlSymptomsResult: null,
        mlFusedResult: null,
        mlReport: null,
        mlStatus: "PROCESSING",
        mlDebug: null,
        mlLastError: null,
      },
      include: CASE_DETAILS_INCLUDE,
    });

    await syncCaseImageRecords({ db: tx, caseId: cid, imageUrls });

    const systemMessage = await createSystemCaseMessage({
      db: tx,
      caseId: cid,
      messageType: "IMAGE_REUPLOAD",
      content: "A replacement image was uploaded for this case. AI review is running again on the updated photo.",
      meta: { caseId: cid, imageUrls },
    });

    await tx.auditLog.create({
      data: {
        actorId: uid,
        action: "CASE_IMAGE_REPLACED",
        targetTable: "Triage_Case",
        targetId: cid,
        metaJson: JSON.stringify({ imageUrls }),
      },
    }).catch(() => {});

    return { triageCase: updatedCase, systemMessage };
  });

  return updated;
}

async function saveMlResults({ caseId, userId, role, mlPayload }) {
  const cid = Number(caseId);
  const uid = Number(userId);

  const triageCase = await prisma.triageCase.findUnique({
    where: { id: cid },
    include: CASE_DETAILS_INCLUDE,
  });
  if (!triageCase) throw new ApiError(404, "Case not found");

  if (role === "PATIENT" && triageCase.patientId !== uid) throw new ApiError(403, "Forbidden");
  if (role === "DOCTOR" && triageCase.assignedDoctorId !== uid) throw new ApiError(403, "Forbidden");

  const data = {};
  ["mlImageResult", "mlSymptomsResult", "mlFusedResult", "mlReport", "mlStatus", "mlDebug", "mlLastError"].forEach((k) => {
    if (mlPayload[k] !== undefined) data[k] = mlPayload[k] ?? null;
  });
  if (!Object.keys(data).length) return triageCase;

  const mlImageResult = data.mlImageResult !== undefined ? data.mlImageResult : triageCase.mlImageResult;
  const mlReport = data.mlReport !== undefined ? data.mlReport : triageCase.mlReport;
  const fusedInput = data.mlFusedResult !== undefined ? data.mlFusedResult : triageCase.mlFusedResult;
  if (fusedInput) {
    const enriched = enrichFusedResult({ fusedResult: fusedInput, mlImageResult: mlImageResult || {}, mlReport: mlReport || {} });
    if (enriched?.fusedResult) data.mlFusedResult = enriched.fusedResult;
  }

  const updated = await prisma.triageCase.update({
    where: { id: cid },
    data,
    include: CASE_DETAILS_INCLUDE,
  });

  const fusedResultForChat = data.mlFusedResult || updated.mlFusedResult;

  // Keep the hidden summary/guidance records in sync for case detail rendering.
  await ensureAiChatMessage({
    caseId: cid,
    fusedResult: fusedResultForChat,
    submittedAt: updated.submittedAt,
  }).catch(() => {});

  // Add one visible AI support message per completed image-analysis state.
  await ensureAutoAiSupportMessage({
    caseId: cid,
    triageCase: updated,
    fusedResult: fusedResultForChat,
  }).catch(() => {});

  await prisma.auditLog
    .create({
      data: {
        actorId: uid,
        action: "CASE_ML_UPDATED",
        targetTable: "Triage_Case",
        targetId: cid,
        metaJson: JSON.stringify({ fields: Object.keys(data) }),
      },
    })
    .catch(() => {});

  return updated;
}

module.exports = {
  createCase,
  listCasesForUser,
  getCaseById,
  assignDoctor,
  requestDoctorAssignment,
  deleteCase,
  updateCase,
  addCaseImages,
  replaceCaseImage,
  saveMlResults,
  saveDoctorReview,
  pickDoctorForAutoAssign,
  enrichFusedResult,
  deriveAiFirstSupportState,
  buildDoctorReviewMessagePayload,
};
