requireDoctorAuth();

const params = new URLSearchParams(window.location.search);
const caseId = params.get("id");

const caseDetails = document.getElementById("caseDetails");
const recommendationEl = document.getElementById("recommendation");
const confidenceEl = document.getElementById("confidenceScore");
const out = document.getElementById("out");

const saveBtn = document.getElementById("saveBtn");
const saveDoctorReviewBtn = document.getElementById("saveDoctorReviewBtn");
const reloadBtn = document.getElementById("reloadBtn");
const logoutBtn = document.getElementById("logoutBtn");
const meLabel = document.getElementById("meLabel");
const aiPanel = document.getElementById("aiPanel");
const patientMedicalInfo = document.getElementById("patientMedicalInfo");
const doctorNotesEl = document.getElementById("doctorNotes");
const doctorRecommendationTextEl = document.getElementById("doctorRecommendationText");
const doctorFollowUpNeededEl = document.getElementById("doctorFollowUpNeeded");
const doctorReviewStatusEl = document.getElementById("doctorReviewStatus");
const ENVIRONMENT_LABELS = {
  HOT_HUMID: "Hot / humid",
  DRY_LOW_HUMIDITY: "Dry / low-humidity",
  DUSTY_POLLUTION: "Dusty / pollution-heavy",
  RAINY_DAMP: "Rainy / damp",
  CHANGED_ENVIRONMENT: "Recently changed environment / traveled",
};
const EXPOSURE_LABELS = {
  SWEATING_HEAT: "Sweating / heat exposure",
  NEW_SKINCARE: "New skincare / cosmetic product",
  OUTDOOR_SUN: "Outdoor exposure / sun",
  DUST_POLLUTION: "Dust / pollution exposure",
  SEASONAL_ALLERGY: "Seasonal allergy period",
};
const DATE_TIME_FORMATTER = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});
const state = {
  caseData: null,
  savingDoctorReview: false,
};

function emergencyContacts() {
  return window.EdgeCareEmergencyConfig?.getContacts?.() || [];
}

function show(obj){
  out.style.display = "block";
  out.textContent = typeof obj === "string" ? obj : JSON.stringify(obj, null, 2);
}

function statusBadge(status){
  const s = (status || "").toUpperCase();
  if (s === "SUBMITTED") return `<span class="badge submitted">AI Support Active</span>`;
  if (s === "IN_REVIEW") return `<span class="badge review">In Review</span>`;
  if (s === "CLOSED") return `<span class="badge closed">Closed</span>`;
  return `<span class="badge">${escapeHtml(s || "UNKNOWN")}</span>`;
}

function fmtDate(iso){
  if (!iso) return "-";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "-" : DATE_TIME_FORMATTER.format(date);
}

function titleize(str){
  return String(str || "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function symptomSelections(caseData = {}) {
  const symptoms = caseData?.symptoms;
  if (Array.isArray(symptoms)) return symptoms;
  if (Array.isArray(symptoms?.selected)) return symptoms.selected;
  return [];
}

function environmentLabel(value = "") {
  return ENVIRONMENT_LABELS[value] || titleize(value);
}

function exposureLabel(value = "") {
  return EXPOSURE_LABELS[value] || titleize(value);
}

function getEnvironmentContext(caseData = {}) {
  const context =
    caseData?.symptoms && typeof caseData.symptoms === "object" && !Array.isArray(caseData.symptoms)
      ? caseData.symptoms.environmentContext || null
      : null;

  if (!context || typeof context !== "object") return null;

  const climate = typeof context.climate === "string" && context.climate.trim() ? context.climate.trim() : null;
  const exposures = Array.isArray(context.exposures) ? context.exposures.filter(Boolean) : [];
  if (!climate && !exposures.length) return null;

  return {
    climate: climate ? environmentLabel(climate) : null,
    exposures: exposures.map(exposureLabel),
    symptoms: symptomSelections(caseData),
  };
}

const SEVERITY_WORDS = new Set(["mild", "moderate", "severe", "uncertain", "low", "high", "unknown"]);

function getPossibleConditionDisplay(fused, mlImageResult){
  const fallback = "Possible skin issue detected";
  if (!fused) return fallback;
  const fda = fused.final_disease_assessment;
  if (fda?.display_name && !SEVERITY_WORDS.has(String(fda.display_name).toLowerCase())) return fda.display_name;
  const disease = fused.disease;
  if (disease?.display_name && !SEVERITY_WORDS.has(String(disease.display_name).toLowerCase())) return disease.display_name;
  const imgDisease = mlImageResult?.disease?.display_name || mlImageResult?.ml_analysis?.disease?.display_name;
  if (imgDisease && !SEVERITY_WORDS.has(String(imgDisease).toLowerCase())) return imgDisease;
  const canonical = fda?.canonical_label || disease?.canonical_label || fused.predicted_class || fused.label;
  if (canonical && !SEVERITY_WORDS.has(String(canonical).toLowerCase())) return titleize(canonical);
  return fallback;
}

function getSeverityDisplay(fused){
  if (!fused) return "Uncertain";
  return fused.severity_status || fused.final_severity_level || fused.severity_level || fused.severity || fused.risk_level || "Uncertain";
}

function getRecommendedNextStep(fused){
  if (!fused) return null;
  const recommended = fused.recommended_actions || {};
  return (Array.isArray(recommended.items) && recommended.items[0]) || fused.recommended_action || fused.recommendation || null;
}

function getRetakeGuidance(fused){
  if (!fused) return { required: false, message: null };
  const recommended = fused.recommended_actions || {};
  const required =
    Boolean(recommended.retake_required) ||
    Boolean(fused?.image_gate?.quality?.retake_required) ||
    Boolean(fused?.patient_guidance?.retake_required);
  if (!required) return { required: false, message: null };
  const message =
    recommended.retake_note ||
    fused?.image_gate?.quality?.retake_note ||
    fused?.patient_guidance?.retake_note ||
    fused?.patient_guidance?.retake_message ||
    "Upload a clearer, closer, well-lit photo for better screening.";
  return { required: true, message };
}

function getUrgentWarning(fused){
  if (!fused) return null;
  const recommended = fused.recommended_actions || {};
  const warning =
    recommended.urgent_warning ||
    fused?.patient_guidance?.urgent_warning ||
    fused?.triage?.urgent_warning ||
    fused?.urgent_warning;
  if (warning === false || warning === null || warning === undefined) return null;
  const str = String(warning).trim();
  return str ? str : null;
}

function getQualityStatus(fused){
  return fused?.image_gate?.quality?.quality_status || fused?.quality_status || null;
}

function getEmergencySupport(caseData = {}, fused = caseData?.mlFusedResult || {}) {
  const display = fused?.display || {};
  const recommended = fused?.recommended_actions || {};
  const fromDisplay = display?.emergency_support || {};
  const careLevel = String(recommended.care_level || fused?.triage_level || fused?.triage || "").toLowerCase();
  const isEmergency =
    fromDisplay.is_emergency === true ||
    display.show_urgent_badge === true ||
    careLevel === "urgent_attention" ||
    caseData?.isEmergency === true;

  return {
    isEmergency,
    heading: fromDisplay.heading || "Seek immediate medical attention",
    guidanceText:
      fromDisplay.guidance_text ||
      "This screening suggests the case may need immediate medical evaluation. Contact emergency services or direct the patient to the nearest hospital now if symptoms are severe or worsening.",
    warningText:
      fromDisplay.warning_text ||
      getUrgentWarning(fused) ||
      null,
    contacts: Array.isArray(fromDisplay.contacts) && fromDisplay.contacts.length ? fromDisplay.contacts : emergencyContacts(),
  };
}

function hasDoctorReview(caseData = {}) {
  return Boolean(
    caseData.doctorReviewedAt ||
    caseData.doctorNotes ||
    caseData.doctorRecommendation ||
    caseData.doctorSeverityOverride ||
    (caseData.doctorFollowUpNeeded !== null && caseData.doctorFollowUpNeeded !== undefined)
  );
}

function assignedDoctorDisplay(caseData = {}) {
  const doctor = caseData.assignedDoctor;
  if (!doctor) return "Assigned doctor";
  const fullName = [doctor.firstName, doctor.lastName].filter(Boolean).join(" ").trim();
  return fullName ? `Dr. ${fullName}` : doctor.user?.email || "Assigned doctor";
}

function patientDisplay(caseData = {}) {
  const patient = caseData?.patient || {};
  const fullName = [patient.firstName, patient.lastName].filter(Boolean).join(" ").trim();
  if (fullName) return fullName;
  return patient.user?.email || "Patient";
}

function doctorIdentity(user = {}) {
  const email = user?.email || "";
  return email ? email.split("@")[0] : "Doctor";
}

function syncSeverityOverrideInputs(value) {
  document.querySelectorAll('input[name="doctorSeverityOverride"]').forEach((input) => {
    input.checked = input.value === value;
  });
}

function selectedSeverityOverride() {
  const input = document.querySelector('input[name="doctorSeverityOverride"]:checked');
  return input?.value || null;
}

function populateDoctorReview(caseData = {}) {
  if (doctorNotesEl) doctorNotesEl.value = caseData.doctorNotes || "";
  if (doctorRecommendationTextEl) {
    doctorRecommendationTextEl.value = caseData.doctorRecommendation || caseData?.result?.recommendation || "";
  }
  if (doctorFollowUpNeededEl) doctorFollowUpNeededEl.checked = Boolean(caseData.doctorFollowUpNeeded);
  syncSeverityOverrideInputs(caseData.doctorSeverityOverride || "");

  if (doctorReviewStatusEl) {
    const reviewed = hasDoctorReview(caseData);
    doctorReviewStatusEl.className = reviewed ? "badge review" : "badge badge--soft";
    doctorReviewStatusEl.textContent = reviewed
      ? `Reviewed on ${fmtDate(caseData.doctorReviewedAt)}`
      : "Not reviewed";
  }

  if (saveDoctorReviewBtn) {
    saveDoctorReviewBtn.disabled = state.savingDoctorReview;
    saveDoctorReviewBtn.textContent = state.savingDoctorReview ? "Saving review..." : "Save review";
  }
}

async function reloadCaseAndChat() {
  await loadCase();
  await window.EdgeCareChat?.reload?.();
}

function getCaseImageUrl(caseData){
  if (!caseData) return null;
  if (Array.isArray(caseData.imageUrls) && caseData.imageUrls.length) return caseData.imageUrls[0];
  if (Array.isArray(caseData.images) && caseData.images.length && caseData.images[0].imageUrl) return caseData.images[0].imageUrl;
  return null;
}

function careLabel(level){
  const v = String(level || "").toLowerCase();
  if (v === "urgent_attention") return "Urgent attention";
  if (v === "priority_review") return "Priority review";
  if (v === "routine_review") return "Routine review";
  return "Home care / monitor";
}

function deriveSeverity(fused){
  if (!fused) return "N/A";
  if (fused.final_severity_level) return fused.final_severity_level;
  if (fused.severity_level || fused.severity || fused.risk_level || fused.fused_label) return fused.severity_level || fused.severity || fused.risk_level || fused.fused_label;
  if (typeof fused.image_severity_score === "number"){
    if (fused.image_severity_score >= 0.75) return "High";
    if (fused.image_severity_score >= 0.4) return "Moderate";
    return "Low";
  }
  return "N/A";
}

function renderPatientMedicalInfo(caseData = {}) {
  if (!patientMedicalInfo) return;

  const patient = caseData.patient || {};
  const allergies = patient.allergies || null;
  const knownMedicalConditions = patient.knownMedicalConditions || null;

  patientMedicalInfo.innerHTML = `
    <div class="case-summary-grid case-summary-grid--rail">
      <div class="case-summary-item">
        <span class="case-summary-label">Allergies</span>
        <strong>${escapeHtml(allergies || "No allergies recorded")}</strong>
      </div>
      <div class="case-summary-item">
        <span class="case-summary-label">Known Medical Conditions</span>
        <strong>${escapeHtml(knownMedicalConditions || "No known medical conditions recorded")}</strong>
      </div>
    </div>
    <div class="health-report-inline">This information is read-only and comes from the patient profile.</div>
  `;
}

function renderAiPanel(mlFusedResult, container, mlImageResult){
  if (!container) return;
  if (!mlFusedResult){
    container.innerHTML = `<div class="empty-state"><strong>No AI summary yet</strong><span>The latest AI triage summary has not been saved for this case.</span></div>`;
    return;
  }
  const display = mlFusedResult.display || null;
  const severity = display?.severity_text || deriveSeverity(mlFusedResult);
  const showCondition = display ? display.show_condition_section !== false : true;
  const condition = display?.condition_text || getPossibleConditionDisplay(mlFusedResult, mlImageResult);
  const conditionNote =
    mlFusedResult.final_disease_assessment?.status && mlFusedResult.final_disease_assessment.status !== "not_available"
      ? ` (${mlFusedResult.final_disease_assessment.status})`
      : "";
  const recommended = mlFusedResult.recommended_actions || {};
  const action = display?.next_step_text || getRecommendedNextStep(mlFusedResult) || "AI suggestion pending";
  const triage = recommended.care_level || mlFusedResult.triage_level || mlFusedResult.triage || null;
  const triageText = display?.triage_text || careLabel(triage);
  const urgentWarning = (display?.show_urgent_badge ?? true) ? getUrgentWarning(mlFusedResult) : null;
  const summaryLine = mlFusedResult.ai_summary_text || mlFusedResult.summary || null;
  const retake = display
    ? { required: Boolean(display.retake_required), message: getRetakeGuidance(mlFusedResult).message }
    : getRetakeGuidance(mlFusedResult);
  const needsReview = recommended.needs_clinician_review === true;
  const quality = getQualityStatus(mlFusedResult);
  const imageAssessment = display?.image_assessment;
  const emergencySupport = getEmergencySupport({}, mlFusedResult);
  container.innerHTML = `
    <div class="row" style="justify-content:space-between; align-items:center;">
      <div class="card-title" style="margin:0;">AI Summary</div>
      <span class="badge result">AI Support Active</span>
    </div>
    ${
      emergencySupport.isEmergency
        ? `<div class="doctor-urgent-banner" style="margin:12px 0 16px;">
            <div class="doctor-urgent-banner__title">Emergency guidance active</div>
            <div class="doctor-urgent-banner__text">${escapeHtml(emergencySupport.guidanceText)}</div>
            <div class="doctor-urgent-banner__meta">${escapeHtml(
              emergencySupport.contacts.map((contact) => `${contact.label}: ${contact.number}`).join(" | ")
            )}</div>
          </div>`
        : ""
    }
    <div class="muted" style="margin:6px 0;">Preliminary AI screening only. This is not a confirmed diagnosis.</div>
    ${
      showCondition
        ? `<div style="color:var(--text); margin:4px 0;"><strong>Possible condition:</strong> ${escapeHtml(condition)}${escapeHtml(conditionNote)}</div>`
        : `<div class="muted" style="margin:4px 0;">Condition: Uncertain</div>`
    }
    <div class="muted" style="margin:4px 0;">Severity: <strong>${escapeHtml(severity)}</strong></div>
    <div style="color:var(--text); margin:4px 0;"><strong>Recommended next step:</strong> ${escapeHtml(action)}</div>
    <div class="muted" style="margin:4px 0;"><strong>Triage level:</strong> ${escapeHtml(triageText)}</div>
    ${imageAssessment ? `<div class="muted" style="margin:4px 0;">Image assessment: ${escapeHtml(imageAssessment)}</div>` : ""}
    ${needsReview ? `<div class="badge result" style="margin-top:6px;">Doctor review advised</div>` : ""}
    ${quality ? `<div class="muted" style="margin-top:4px;">Image quality: ${escapeHtml(titleize(quality))}</div>` : ""}
    ${retake.required ? `<div class="badge warning" style="margin-top:6px;">${escapeHtml(retake.message)}</div>` : ""}
    ${!emergencySupport.isEmergency && urgentWarning ? `<div class="banner danger" style="margin-top:8px;">Urgent warning: ${escapeHtml(urgentWarning)}</div>` : ""}
    ${summaryLine ? `<div class="muted" style="margin-top:8px;">${escapeHtml(summaryLine)}</div>` : ""}
  `;
}

async function loadMe(){
  const me = await apiFetch("/users/me", { method: "GET" });
  const u = me.data;
  meLabel.innerHTML = `
    <span class="user-chip__primary">${escapeHtml(doctorIdentity(u))}</span>
    <span class="user-chip__role">Doctor</span>
  `;
}

async function loadCase(){
  if (!caseId){
    caseDetails.innerHTML = `<div class="empty-state empty-state--error"><strong>Case not found</strong><span>Missing case ID in the page URL.</span></div>`;
    if (patientMedicalInfo) {
      patientMedicalInfo.innerHTML = `<div class="empty-state empty-state--error"><strong>Medical history unavailable</strong><span>Missing case ID in the page URL.</span></div>`;
    }
    return;
  }

  out.style.display = "none";
  const resp = await apiFetch(`/cases/${caseId}`, { method: "GET" });
  const c = resp.data;
  state.caseData = c;

  const title = c.intake?.title || `Case #${c.id}`;
  const patientName = patientDisplay(c);
  const patientEmail = c.patient?.user?.email || "";
  const emergencySupport = getEmergencySupport(c);
  const environmentContext = getEnvironmentContext(c);
  const emergency = emergencySupport.isEmergency ? `<span class="badge emergency">Urgent</span>` : "";
  const imageUrl = getCaseImageUrl(c);
  renderAiPanel(c.mlFusedResult, aiPanel, c.mlImageResult);
  renderPatientMedicalInfo(c);

  caseDetails.innerHTML = `
    <div class="stack" style="gap:16px;">
      ${
        emergencySupport.isEmergency
          ? `<div class="doctor-urgent-banner">
              <div class="doctor-urgent-banner__title">${escapeHtml(emergencySupport.heading)}</div>
              <div class="doctor-urgent-banner__text">${escapeHtml(emergencySupport.guidanceText)}</div>
              ${
                emergencySupport.warningText
                  ? `<div class="doctor-urgent-banner__meta">${escapeHtml(emergencySupport.warningText)}</div>`
                  : ""
              }
            </div>`
          : ""
      }
      <div class="case-header">
        <div class="list-main">
          <div class="list-title">${escapeHtml(title)}</div>
          <div class="list-meta">
            <span>Case #${c.id}</span>
            <span>Patient: ${escapeHtml(patientName)}</span>
            <span>${escapeHtml(fmtDate(c.submittedAt))}</span>
            ${patientEmail && patientEmail !== patientName ? `<span>${escapeHtml(patientEmail)}</span>` : ""}
          </div>
        </div>
        <div class="item-right" style="gap:6px;">
          ${statusBadge(c.status)}
          ${emergency}
        </div>
      </div>
      <div class="case-summary-grid">
        <div class="case-summary-item">
          <span class="case-summary-label">Duration</span>
          <strong>${escapeHtml(c.intake?.duration || "-")}</strong>
        </div>
        <div class="case-summary-item">
          <span class="case-summary-label">Medications</span>
          <strong>${escapeHtml(c.intake?.medications || "-")}</strong>
        </div>
        <div class="case-summary-item">
          <span class="case-summary-label">Assigned doctor</span>
          <strong>${escapeHtml(assignedDoctorDisplay(c))}</strong>
        </div>
        <div class="case-summary-item">
          <span class="case-summary-label">Status</span>
          <strong>${escapeHtml(titleize(c.status || "submitted"))}</strong>
        </div>
      </div>
      ${
        environmentContext
          ? `<div class="card" style="margin-top:8px;">
              <div class="card-title">Environmental context</div>
              <div class="list-meta" style="margin-top:8px;">
                <span>Climate: ${escapeHtml(environmentContext.climate || "Not provided")}</span>
                <span>Triggers: ${escapeHtml(
                  environmentContext.exposures.length ? environmentContext.exposures.join(", ") : "Not provided"
                )}</span>
              </div>
              ${
                environmentContext.symptoms.length
                  ? `<div class="muted" style="margin-top:8px;">Reported symptoms: ${escapeHtml(environmentContext.symptoms.join(", "))}</div>`
                  : ""
              }
            </div>`
          : ""
      }
      <div class="card" style="margin-top:8px;">
        <div class="card-title">Case image</div>
        ${
          imageUrl
            ? `<img src="${escapeHtml(imageUrl)}" alt="Uploaded case image" style="width:100%;max-width:100%;border-radius:12px;margin-top:8px;">`
            : `<div class="muted" style="margin-top:6px;">No image uploaded.</div>`
        }
      </div>
    </div>
  `;

  // preload existing result into form
  if (c.result){
    recommendationEl.value = c.result.recommendation || "";
    confidenceEl.value = (c.result.confidenceScore ?? "") === null ? "" : (c.result.confidenceScore ?? "");
  } else if (!recommendationEl.value) {
    const suggested = c.mlFusedResult?.recommended_actions?.items?.[0] || c.mlFusedResult?.recommended_action;
    if (suggested) recommendationEl.value = suggested;
  } else {
    recommendationEl.value = "";
    confidenceEl.value = "";
  }

  populateDoctorReview(c);
}

saveBtn.addEventListener("click", async () => {
  try{
    if (!caseId) return;

    const recommendation = recommendationEl.value.trim();
    if (!recommendation) {
      toast?.warn?.("Add a recommendation before saving.");
      return;
    }

    const confidenceScoreRaw = confidenceEl.value;
    const body = { recommendation };

    if (confidenceScoreRaw !== "" && confidenceScoreRaw !== null && confidenceScoreRaw !== undefined){
      const n = Number(confidenceScoreRaw);
      if (Number.isNaN(n) || n < 0 || n > 1) {
        show("Confidence must be a number between 0 and 1.");
        return;
      }
      body.confidenceScore = n;
    }

    show("Saving AI recommendation...");
    const resp = await apiFetch(`/triage/cases/${caseId}/result`, {
      method: "PUT",
      body: JSON.stringify(body),
    });

    show(resp);
    toast?.success?.("AI recommendation saved.");
    await reloadCaseAndChat();
  }catch(e){
    toast?.error?.(e.message || "Unable to save the AI recommendation");
    show({ message: e.message, status: e.status, payload: e.payload });
  }
});

saveDoctorReviewBtn?.addEventListener("click", async () => {
  try {
    if (!caseId) return;

    const doctorNotes = doctorNotesEl?.value.trim() || "";
    const doctorRecommendation = doctorRecommendationTextEl?.value.trim() || "";
    const doctorSeverityOverride = selectedSeverityOverride();
    const doctorFollowUpNeeded = Boolean(doctorFollowUpNeededEl?.checked);

    if (!doctorNotes && !doctorRecommendation && !doctorSeverityOverride && !doctorFollowUpNeeded) {
      toast?.warn?.("Add notes, a recommendation, a severity override, or mark follow-up before saving.");
      return;
    }

    state.savingDoctorReview = true;
    populateDoctorReview(state.caseData || {});

    const response = await apiFetch(`/cases/${caseId}/doctor-review`, {
      method: "POST",
      body: JSON.stringify({
        doctorNotes: doctorNotes || null,
        doctorRecommendation: doctorRecommendation || null,
        doctorSeverityOverride: doctorSeverityOverride || null,
        doctorFollowUpNeeded,
      }),
    });

    const result = response?.data || {};
    if (result.systemMessage) {
      window.EdgeCareChat?.appendMessages?.(result.systemMessage);
    }
    if (result.case) {
      state.caseData = result.case;
      populateDoctorReview(state.caseData);
    }

    toast?.success?.("Doctor review saved.");
    await reloadCaseAndChat();
  } catch (e) {
    toast?.error?.(e.message || "Unable to save doctor review");
    show({ message: e.message, status: e.status, payload: e.payload });
  } finally {
    state.savingDoctorReview = false;
    populateDoctorReview(state.caseData || {});
  }
});

reloadBtn.addEventListener("click", reloadCaseAndChat);

logoutBtn.addEventListener("click", () => logout("/doctor-login.html?role=DOCTOR"));

(async function init(){
  try{
    await loadMe();
    await loadCase();
  }catch(e){
    caseDetails.innerHTML = `<div class="empty-state empty-state--error"><strong>Unable to load this case</strong><span>${escapeHtml(e?.message || "Try refreshing the page.")}</span></div>`;
    if (patientMedicalInfo) {
      patientMedicalInfo.innerHTML = `<div class="empty-state empty-state--error"><strong>Unable to load medical history</strong><span>${escapeHtml(e?.message || "Try refreshing the page.")}</span></div>`;
    }
    aiPanel.innerHTML = `<div class="empty-state empty-state--error"><strong>Unable to load AI summary</strong><span>${escapeHtml(e?.message || "Try refreshing the page.")}</span></div>`;
    show({ message: e.message, status: e.status, payload: e.payload });
  }
})();
