requirePatientAuth();

const params = new URLSearchParams(window.location.search);
const caseId = Number(params.get("id"));

const patientCaseSummary = document.getElementById("patientCaseSummary");
const patientCaseInsights = document.getElementById("patientCaseInsights");
const patientCaseActions = document.getElementById("patientCaseActions");
const meLabel = document.getElementById("meLabel");
const logoutBtn = document.getElementById("logoutBtn");
const out = document.getElementById("out");
const reuploadInput = document.getElementById("caseReuploadInput");
const chatModeChip = document.getElementById("chatModeChip");
const chatModeDot = document.getElementById("chatModeDot");
const chatModeText = document.getElementById("chatModeText");
const chatHeaderMeta = document.getElementById("chatHeaderMeta");
const reportUtils = window.EdgeCareReports;
const DATE_TIME_FORMATTER = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

const state = {
  caseData: null,
  profile: null,
  assigningDoctor: false,
  uploadingImage: false,
};

function fmtDate(iso) {
  if (!iso) return "-";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "-" : DATE_TIME_FORMATTER.format(date);
}

function statusBadge(status) {
  const value = String(status || "").toUpperCase();
  if (value === "SUBMITTED") return '<span class="badge submitted">AI Support Active</span>';
  if (value === "IN_REVIEW") return '<span class="badge review">In Review</span>';
  if (value === "CLOSED") return '<span class="badge closed">Closed</span>';
  return `<span class="badge">${escapeHtml(value || "UNKNOWN")}</span>`;
}

function showDebug(value) {
  if (!out) return;
  out.style.display = "block";
  out.textContent = typeof value === "string" ? value : JSON.stringify(value, null, 2);
}

function patientDisplayName(profile = {}) {
  const fullName = [profile.firstName, profile.lastName].filter(Boolean).join(" ").trim();
  if (fullName) return fullName;
  const email = profile.user?.email || "";
  return email ? email.split("@")[0] : "Patient";
}

function setPatientIdentity(profile = {}) {
  if (!meLabel) return;
  meLabel.innerHTML = `
    <span class="user-chip__primary">${escapeHtml(patientDisplayName(profile))}</span>
    <span class="user-chip__role">Patient</span>
  `;
}

function titleize(value) {
  return String(value || "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function getCaseImageUrl(caseData) {
  if (!caseData) return null;
  if (Array.isArray(caseData.imageUrls) && caseData.imageUrls.length) return caseData.imageUrls[0];
  if (Array.isArray(caseData.images) && caseData.images.length) {
    const latestImage = [...caseData.images].sort((a, b) => new Date(b.uploadedAt || 0) - new Date(a.uploadedAt || 0))[0];
    if (latestImage?.imageUrl) return latestImage.imageUrl;
  }
  return null;
}

function doctorDisplay(caseData) {
  const doctor = caseData?.assignedDoctor;
  if (!doctor) return "AI Support Active";
  const fullName = [doctor.firstName, doctor.lastName].filter(Boolean).join(" ").trim();
  return fullName ? `Dr. ${fullName}` : doctor.user?.email || "Assigned doctor";
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

function reviewSeverityLabel(caseData = {}) {
  const value = String(caseData?.doctorSeverityOverride || "").toLowerCase();
  if (!value) return null;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function deriveSupportState(caseData) {
  const display = caseData?.mlFusedResult?.display || {};
  const actionCtas = display.action_ctas || {};
  return {
    state: display.support_state || "AI_CHAT",
    prompt: display.support_prompt || "AI support is active for this case.",
    allowReupload: actionCtas.reupload_image !== false,
    allowDoctorRequest: actionCtas.request_doctor !== false && !caseData?.assignedDoctorId,
    allowAiChat: actionCtas.continue_ai_chat !== false,
  };
}

function recommendedNextStep(caseData) {
  const fused = caseData?.mlFusedResult || {};
  const display = fused.display || {};
  const recommended = fused.recommended_actions || {};
  return (
    display.next_step_text ||
    (Array.isArray(recommended.items) && recommended.items[0]) ||
    fused.recommended_action ||
    fused.recommendation ||
    "Continue the AI chat if you still need help."
  );
}

function triageLabel(caseData) {
  const fused = caseData?.mlFusedResult || {};
  const display = fused.display || {};
  if (display.triage_text) return display.triage_text;
  const recommended = fused.recommended_actions || {};
  const value = String(recommended.care_level || fused.triage_level || fused.triage || "").toLowerCase();
  if (value === "urgent_attention") return "Urgent attention";
  if (value === "priority_review") return "Priority review";
  if (value === "routine_review") return "Routine review";
  return "Home care / monitor";
}

function severityLabel(caseData) {
  const fused = caseData?.mlFusedResult || {};
  const display = fused.display || {};
  return display.severity_text || fused.final_severity_level || fused.severity || "Pending";
}

function conditionLabel(caseData) {
  const fused = caseData?.mlFusedResult || {};
  const display = fused.display || {};
  return display.condition_text || "Condition unclear from image";
}

function imageAssessment(caseData) {
  return caseData?.mlFusedResult?.display?.image_assessment || "Image review pending";
}

function getEmergencySupport(caseData) {
  return reportUtils.getEmergencySupport(caseData);
}

function qualityLabel(caseData) {
  const fused = caseData?.mlFusedResult || {};
  const quality = fused?.image_gate?.quality?.quality_status || fused?.quality_status || caseData?.mlImageResult?.quality || null;
  return quality ? titleize(quality) : null;
}

function caseStatusText(caseData = {}) {
  const value = String(caseData.status || "").toUpperCase();
  if (value === "SUBMITTED") return "AI Support Active";
  if (value === "IN_REVIEW") return "In Review";
  if (value === "CLOSED") return "Closed";
  return titleize(value || "unknown");
}

function patientName(caseData = {}) {
  const patient = caseData?.patient || {};
  const fullName = [patient.firstName, patient.lastName].filter(Boolean).join(" ").trim();
  if (fullName) return fullName;
  const email = patient.user?.email || "";
  return email ? email.split("@")[0] : "Patient";
}

function latestImageMeta(caseData = {}) {
  const images = Array.isArray(caseData.images) ? [...caseData.images] : [];
  if (!images.length) return null;
  const latest = images.sort((a, b) => new Date(b.uploadedAt || 0) - new Date(a.uploadedAt || 0))[0];
  if (!latest) return null;
  return {
    uploadedAt: latest.uploadedAt ? fmtDate(latest.uploadedAt) : null,
    imageUrl: latest.imageUrl || getCaseImageUrl(caseData),
  };
}

function buildDoctorReviewSummary(caseData = {}) {
  const recommendation = caseData?.doctorRecommendation || null;
  const reviewedAt = caseData?.doctorReviewedAt || null;
  return {
    available: hasDoctorReview(caseData),
    doctorName: doctorDisplay(caseData),
    notes: caseData?.doctorNotes || null,
    recommendation,
    severityOverride: reviewSeverityLabel(caseData),
    followUpNeeded:
      caseData?.doctorFollowUpNeeded !== null && caseData?.doctorFollowUpNeeded !== undefined
        ? caseData.doctorFollowUpNeeded
        : null,
    reviewedAt: reviewedAt ? fmtDate(reviewedAt) : null,
  };
}

function buildHealthReport(caseData = {}) {
  return reportUtils.buildHealthReport(caseData, { patientName: patientDisplayName(state.profile || {}) });
}

function renderReportGrid(items = []) {
  return `
    <div class="health-report-grid">
      ${items
        .map(
          (item) => `
            <div class="health-report-item">
              <span class="case-summary-label">${escapeHtml(item.label)}</span>
              <strong>${escapeHtml(item.value || "-")}</strong>
            </div>
          `
        )
        .join("")}
    </div>
  `;
}

function renderHealthReport(report, caseData) {
  return `
    <section class="case-rail-card health-report-card patient-case-subcard">
      <div class="health-report-header">
        <div>
          <div class="case-section-kicker">Health report</div>
          <div class="card-title">Structured Triage Report</div>
          <div class="card-subtitle">A patient-friendly summary of the current care guidance, emergency guidance, and doctor review.</div>
        </div>
        <button class="btn" type="button" data-case-action="export-report">Export report</button>
      </div>

      <div class="health-report-section">
        <div class="health-report-section__title">Case Overview</div>
        ${renderReportGrid([
          { label: "Patient", value: report.overview.patientName },
          { label: "Reference", value: report.overview.reference },
          { label: "Created", value: report.overview.createdAt },
          { label: "Current status", value: report.overview.status },
          { label: "Assigned doctor", value: report.overview.assignedDoctor },
        ])}
      </div>

      <div class="health-report-section">
        <div class="health-report-section__title">${escapeHtml(report.currentGuidance.sourceLabel)}</div>
        ${renderReportGrid([
          { label: "Image review", value: report.currentGuidance.imageAssessment },
          { label: "Possible condition", value: report.currentGuidance.condition },
          { label: "Current severity", value: report.currentGuidance.severity },
          { label: "Care level", value: report.currentGuidance.careLevel },
        ])}
        <p class="health-report-copy">${escapeHtml(report.currentGuidance.summary)}</p>
        <div class="health-report-note">
          <span class="case-summary-label">${escapeHtml(report.currentGuidance.source === "DOCTOR" ? "Doctor recommendation" : "Recommended next step")}</span>
          <strong>${escapeHtml(report.currentGuidance.nextStep)}</strong>
        </div>
        ${report.currentGuidance.quality ? `<div class="health-report-inline">Image quality: ${escapeHtml(report.currentGuidance.quality)}</div>` : ""}
      </div>

      ${
        report.environmentContext
          ? `<div class="health-report-section">
              <div class="health-report-section__title">Environmental Context</div>
              ${renderReportGrid([
                { label: "Climate / environment", value: report.environmentContext.climate || "Not provided" },
                {
                  label: "Possible trigger context",
                  value: report.environmentContext.exposures.length
                    ? report.environmentContext.exposures.join(", ")
                    : "Not provided",
                },
                ...(report.environmentContext.symptomSummary
                  ? [{ label: "Reported symptoms", value: report.environmentContext.symptomSummary }]
                  : []),
              ])}
              <div class="health-report-note">
                <span class="case-summary-label">How this context helps</span>
                <strong>${escapeHtml(report.environmentContext.guidance)}</strong>
              </div>
            </div>`
          : ""
      }

      ${
        report.emergency
          ? `<div class="health-report-section health-report-section--emergency">
              <div class="health-report-section__title">Emergency Guidance</div>
              <p class="health-report-copy">${escapeHtml(report.emergency.guidanceText)}</p>
              ${
                report.emergency.warningText
                  ? `<div class="health-report-note health-report-note--danger">
                      <span class="case-summary-label">Urgent guidance</span>
                      <strong>${escapeHtml(report.emergency.warningText)}</strong>
                    </div>`
                  : ""
              }
              <div class="health-report-actions">
                ${report.emergency.contacts
                  .map(
                    (contact) => `
                      <div class="health-report-action">
                        <span>${escapeHtml(contact.label)}</span>
                        <strong>${escapeHtml(contact.number)}</strong>
                      </div>
                    `
                  )
                  .join("")}
              </div>
            </div>`
          : ""
      }

      <div class="health-report-section">
        <div class="health-report-section__title">Doctor Review</div>
        ${
          report.doctorReview.available
            ? `
              ${renderReportGrid([
                { label: "Reviewed by", value: report.doctorReview.doctorName },
                { label: "Reviewed at", value: report.doctorReview.reviewedAt || "Pending" },
                { label: "Doctor-reviewed severity", value: report.doctorReview.severityOverride || "Not specified" },
                {
                  label: "Follow-up needed",
                  value:
                    report.doctorReview.followUpNeeded === null
                      ? "Not specified"
                      : report.doctorReview.followUpNeeded
                        ? "Yes"
                        : "No",
                },
              ])}
              ${
                report.doctorReview.notes
                  ? `<div class="health-report-note">
                      <span class="case-summary-label">Notes</span>
                      <strong>${escapeHtml(report.doctorReview.notes)}</strong>
                    </div>`
                  : ""
              }
              ${
                report.doctorReview.recommendation
                  ? `<div class="health-report-note">
                      <span class="case-summary-label">Recommendation</span>
                      <strong>${escapeHtml(report.doctorReview.recommendation)}</strong>
                    </div>`
                  : ""
              }
            `
            : `<div class="health-report-empty">
                <strong>No doctor review has been added yet.</strong>
                <span>${caseData?.assignedDoctorId ? "Your doctor has been assigned, but formal review notes have not been published yet." : "AI support is currently active for this case. You can request a doctor review if you want human review."}</span>
              </div>`
        }
      </div>

      <div class="health-report-section">
        <div class="health-report-section__title">Latest Uploaded Image</div>
        ${renderReportGrid([
          { label: "Evidence status", value: report.latestImage.hasImage ? "Latest image on file" : "No image on file" },
          { label: "Uploaded", value: report.latestImage.uploadedAt },
        ])}
      </div>
    </section>
  `;
}

function renderEmergencyCard(report) {
  const emergencySupport = report?.emergency || null;
  if (!emergencySupport?.isEmergency) return "";

  return `
    <section class="case-rail-card emergency-card">
      <div class="case-section-kicker emergency-card__kicker">Emergency support</div>
      <div class="emergency-card__head">
        <div>
          <div class="card-title">${escapeHtml(emergencySupport.heading)}</div>
          <div class="card-subtitle">${escapeHtml(emergencySupport.guidanceText)}</div>
        </div>
        <span class="badge emergency">${escapeHtml(emergencySupport.label)}</span>
      </div>
      ${
        emergencySupport.warningText
          ? `<p class="emergency-card__warning">${escapeHtml(emergencySupport.warningText)}</p>`
          : ""
      }
      <div class="emergency-card__actions">
        ${emergencySupport.contacts
          .map(
            (contact) => `
              <a class="emergency-action" href="${escapeHtml(contact.href || `tel:${contact.number}`)}">
                <span>${escapeHtml(contact.label)}</span>
                <strong>${escapeHtml(contact.number)}</strong>
              </a>
            `
          )
          .join("")}
        <div class="emergency-action emergency-action--note">
          <span>Next step</span>
          <strong>Seek urgent care now</strong>
        </div>
      </div>
    </section>
  `;
}

function renderSummaryCard(caseData) {
  const support = deriveSupportState(caseData);
  const environmentContext = reportUtils.getEnvironmentContext(caseData);
  const healthReport = buildHealthReport(caseData);

  return `
    <section class="case-rail-card patient-case-subcard patient-case-summary-card">
      <div class="case-header patient-case-subcard__header">
        <div class="stack" style="gap:8px;">
          <div class="case-section-kicker">Triage Snapshot</div>
          <div class="card-title">${escapeHtml(caseData?.intake?.title || `Case #${caseData?.id || "-"}`)}</div>
          <div class="card-subtitle">Current status, care guidance, and doctor review progress.</div>
        </div>
        <div class="item-right" style="gap:8px;">
          ${statusBadge(caseData?.status)}
          ${getEmergencySupport(caseData).isEmergency ? '<span class="badge emergency">Urgent</span>' : ""}
        </div>
      </div>

      <div class="list-meta" style="margin-top:6px;">
        <span>Case #${caseData?.id || "-"}</span>
        <span>${escapeHtml(fmtDate(caseData?.submittedAt))}</span>
        <span>${escapeHtml(doctorDisplay(caseData))}</span>
      </div>

      <div class="case-summary-grid" style="margin-top:16px;">
        <div class="case-summary-item">
          <span class="case-summary-label">Current severity</span>
          <strong>${escapeHtml(healthReport.currentGuidance.severity)}</strong>
        </div>
        <div class="case-summary-item">
          <span class="case-summary-label">Care level</span>
          <strong>${escapeHtml(healthReport.currentGuidance.careLevel)}</strong>
        </div>
        <div class="case-summary-item">
          <span class="case-summary-label">Image review</span>
          <strong>${escapeHtml(healthReport.currentGuidance.imageAssessment)}</strong>
        </div>
        <div class="case-summary-item">
          <span class="case-summary-label">Doctor review</span>
          <strong>${escapeHtml(healthReport.doctorReview.available ? "Available" : "Pending")}</strong>
        </div>
      </div>

      <div class="health-report-note" style="margin-top:16px;">
        <span class="case-summary-label">${escapeHtml(healthReport.currentGuidance.source === "DOCTOR" ? "Doctor recommendation" : "Recommended next step")}</span>
        <strong>${escapeHtml(healthReport.currentGuidance.nextStep)}</strong>
      </div>

      ${
        support.prompt
          ? `<div class="health-report-inline" style="margin-top:12px;">${escapeHtml(support.prompt)}</div>`
          : ""
      }

      ${
        environmentContext
          ? `<div class="health-report-note" style="margin-top:16px;">
              <span class="case-summary-label">Environmental context</span>
              <strong>${escapeHtml(
                [
                  environmentContext.climate ? `Climate: ${environmentContext.climate}` : null,
                  environmentContext.exposures.length
                    ? `Triggers: ${environmentContext.exposures.join(", ")}`
                    : null,
                  environmentContext.symptomSummary ? `Symptoms: ${environmentContext.symptomSummary}` : null,
                ].filter(Boolean).join(" | ")
              )}</strong>
            </div>`
          : ""
      }
    </section>
  `;
}

function renderImageCard(caseData) {
  const imageUrl = getCaseImageUrl(caseData);
  const latestImage = latestImageMeta(caseData);

  return `
    <section class="case-rail-card case-image-card patient-case-subcard">
      <div class="case-section-kicker">Case image</div>
      <div class="card-title">Latest Upload</div>
      <div class="card-subtitle">${
        latestImage?.uploadedAt ? `Updated ${escapeHtml(latestImage.uploadedAt)}` : "Latest image on file."
      }</div>
      <div class="case-image-frame">
        <div class="case-image-stage">
          ${
            imageUrl
              ? `<img src="${escapeHtml(imageUrl)}" alt="Case image" class="case-image" />`
              : '<div class="case-image-empty">No image uploaded yet.</div>'
          }
        </div>
      </div>
      <button class="btn case-image-button" type="button" data-case-action="reupload">Re-upload image</button>
    </section>
  `;
}

function renderCaseActions(caseData) {
  const support = deriveSupportState(caseData);
  const doctorReview = buildDoctorReviewSummary(caseData);

  return `
    <section class="case-rail-card patient-case-subcard patient-case-actions-card">
      <div class="case-section-kicker">Actions</div>
      <div class="card-title">Case Actions</div>
      <div class="card-subtitle">Manage your case without leaving the conversation.</div>
      <div class="chat-quick-actions" style="margin-top:16px;">
        <button class="btn" type="button" data-case-action="reupload">Re-upload image</button>
        <button class="btn primary" type="button" data-case-action="assign-doctor">Request doctor review</button>
        <button class="btn" type="button" data-case-action="export-report">Export report</button>
      </div>
      <div class="health-report-note" style="margin-top:16px;">
        <span class="case-summary-label">Support state</span>
        <strong>${escapeHtml(support.prompt || "AI support is active for this case.")}</strong>
      </div>
      ${
        doctorReview.available
          ? `<div class="health-report-note" style="margin-top:16px;">
              <span class="case-summary-label">Latest doctor update</span>
              <strong>${escapeHtml(doctorReview.recommendation || doctorReview.notes || "Doctor review is available in the report panel above.")}</strong>
            </div>`
          : ""
      }
    </section>
  `;
}

function renderCaseError(message) {
  const summaryError = `<div class="empty-state empty-state--error"><strong>Unable to load this case</strong><span>${escapeHtml(message || "Try refreshing the page.")}</span></div>`;
  const insightsError = `<div class="empty-state empty-state--error"><strong>Unable to load care insights</strong><span>${escapeHtml(message || "Try refreshing the page.")}</span></div>`;
  const actionsError = `<div class="empty-state empty-state--error"><strong>Unable to load case actions</strong><span>${escapeHtml(message || "Try refreshing the page.")}</span></div>`;
  if (patientCaseSummary) patientCaseSummary.innerHTML = summaryError;
  if (patientCaseInsights) patientCaseInsights.innerHTML = insightsError;
  if (patientCaseActions) patientCaseActions.innerHTML = actionsError;
}

function renderCase(caseData) {
  const healthReport = buildHealthReport(caseData);

  patientCaseSummary.innerHTML = `
    ${renderEmergencyCard(healthReport)}
    ${renderSummaryCard(caseData)}
    ${renderImageCard(caseData)}
  `;

  patientCaseInsights.innerHTML = renderHealthReport(healthReport, caseData);
  patientCaseActions.innerHTML = renderCaseActions(caseData);

  updateActionStates();
  updateChatHeader(caseData, deriveSupportState(caseData));
}

function updateActionStates() {
  const support = deriveSupportState(state.caseData || {});
  const doctorAssigned = Boolean(state.caseData?.assignedDoctorId);

  document.querySelectorAll('[data-case-action="assign-doctor"]').forEach((button) => {
    const disabled = state.assigningDoctor || doctorAssigned || !support.allowDoctorRequest;
    button.disabled = disabled;
    button.textContent = doctorAssigned
      ? "In Review"
      : state.assigningDoctor
        ? "Requesting doctor review..."
        : "Request doctor review";
  });

  document.querySelectorAll('[data-case-action="reupload"]').forEach((button) => {
    button.disabled = state.uploadingImage || !support.allowReupload;
    button.textContent = state.uploadingImage ? "Uploading image..." : "Re-upload image";
  });
}

function updateChatHeader(caseData, support) {
  if (!chatModeChip) return;

  const doctorAssigned = Boolean(caseData?.assignedDoctorId);
  const emergencySupport = getEmergencySupport(caseData);
  const mlStatus = String(caseData?.mlStatus || "").toUpperCase();
  const status = String(caseData?.status || "").toUpperCase();
  const waitingForDoctor = !doctorAssigned && status === "IN_REVIEW";
  const badgeText = status === "CLOSED"
    ? "Closed"
    : status === "IN_REVIEW"
      ? "In Review"
      : mlStatus === "COMPLETED"
        ? "AI Support Active"
        : "AI Support Active";

  if (chatModeText) chatModeText.textContent = badgeText;
  chatModeChip.className = status === "IN_REVIEW" || doctorAssigned ? "chat-mode-chip chat-mode-chip--doctor" : "chat-mode-chip chat-mode-chip--ai";
  if (chatModeDot) chatModeDot.className = status === "IN_REVIEW" || doctorAssigned ? "chat-mode-dot chat-mode-dot--doctor" : "chat-mode-dot";
  if (!chatHeaderMeta) return;

  const meta = [`Case #${caseData?.id || "-"}`];
  if (emergencySupport.isEmergency) meta.push("Urgent");
  if (status === "CLOSED") meta.push("Closed");
  else if (waitingForDoctor) meta.push("Doctor requested");
  meta.push(doctorAssigned ? doctorDisplay(caseData) : "No doctor assigned");

  chatHeaderMeta.innerHTML = meta
    .map((item) => `<span class="chat-meta-chip">${escapeHtml(item)}</span>`)
    .join("");
}

async function loadMe() {
  const profile = await apiFetch("/patient/profile", { method: "GET" }, { loginPath: "/patient-login.html" });
  state.profile = profile?.data || null;
  setPatientIdentity(profile?.data || {});
}

async function loadCase() {
  if (!caseId) {
    renderCaseError("Missing case ID in the page URL.");
    return;
  }

  try {
    const response = await apiFetch(`/cases/${caseId}`, { method: "GET" }, { loginPath: "/patient-login.html" });
    state.caseData = response.data;
    renderCase(state.caseData);
  } catch (error) {
    renderCaseError(error?.message || "Try refreshing the page.");
    showDebug(error?.payload || error);
  }
}

async function refreshCaseAndChat() {
  await loadCase();
  await window.EdgeCareChat?.reload?.();
}

function exportCurrentCaseReport() {
  if (!state.caseData) return;
  try {
    reportUtils.exportCurrentCaseReport(state.caseData, {
      patientName: patientDisplayName(state.profile || {}),
    });
    toast?.success?.("Report export opened. Use Print / Save as PDF to download it.");
  } catch (error) {
    toast?.error?.(error?.message || "Unable to open the report export");
  }
}

async function requestDoctorAssignment() {
  if (!state.caseData || state.caseData.assignedDoctorId || state.assigningDoctor) return;

  state.assigningDoctor = true;
  updateActionStates();

  try {
    const response = await apiFetch(`/cases/${caseId}/request-doctor`, {
      method: "POST",
      body: JSON.stringify({}),
    }, { loginPath: "/patient-login.html" });

    const result = response?.data || {};
    if (result.systemMessage) {
      window.EdgeCareChat?.appendMessages?.(result.systemMessage);
    }
    if (result.case) {
      state.caseData = result.case;
      renderCase(state.caseData);
    }

    await window.EdgeCareChat?.reload?.();

    if (result.alreadyAssigned) {
      toast?.warn?.("This case is already in review.");
    } else if (result.assigned) {
      toast?.success?.("Doctor review requested.");
    } else {
      toast?.warn?.("No doctor is currently available. You can keep using AI Support Active and request doctor review again later.");
    }
  } catch (error) {
    toast?.error?.(error?.message || "Unable to request doctor review");
    showDebug(error?.payload || error);
  } finally {
    state.assigningDoctor = false;
    updateActionStates();
  }
}

function openReuploadPicker() {
  if (!reuploadInput || state.uploadingImage) return;
  reuploadInput.value = "";
  reuploadInput.click();
}

async function handleReupload(event) {
  const files = Array.from(event?.target?.files || []).filter(Boolean);
  if (!files.length || !state.caseData) return;

  state.uploadingImage = true;
  updateActionStates();

  try {
    const result = await window.EdgeCareCaseMl.runAiPipeline({
      caseId,
      files: [files[0]],
      payload: window.EdgeCareCaseMl.buildPayloadFromCase(state.caseData),
      mode: "replace",
      onStatus: (message) => toast?.info?.(message),
    });

    const systemMessage = result?.imageUpdateResponse?.data?.systemMessage || null;
    if (systemMessage) {
      window.EdgeCareChat?.appendMessages?.(systemMessage);
    }

    await refreshCaseAndChat();

    if (result.warnings?.length) {
      toast?.warn?.(`Image updated, but AI review returned warnings: ${result.warnings.join("; ")}`);
    } else {
      toast?.success?.("Image updated and AI summary refreshed.");
    }
  } catch (error) {
    toast?.error?.(error?.message || "Unable to re-upload the image");
    showDebug(error?.payload || error);
  } finally {
    state.uploadingImage = false;
    updateActionStates();
  }
}

document.addEventListener("click", (event) => {
  const actionButton = event.target.closest("[data-case-action]");
  if (!actionButton) return;

  const action = actionButton.getAttribute("data-case-action");
  if (action === "assign-doctor") {
    requestDoctorAssignment();
  }
  if (action === "reupload") {
    openReuploadPicker();
  }
  if (action === "export-report") {
    exportCurrentCaseReport();
  }
});

reuploadInput?.addEventListener("change", handleReupload);
logoutBtn?.addEventListener("click", () => logout("/patient-login.html?role=PATIENT"));

(async function init() {
  await loadMe();
  await loadCase();
})();
