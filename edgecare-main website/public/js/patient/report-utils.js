(function () {
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

  function emergencyContacts() {
    return window.EdgeCareEmergencyConfig?.getContacts?.() || [];
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function fmtDate(iso) {
    if (!iso) return "-";
    const date = new Date(iso);
    return Number.isNaN(date.getTime()) ? "-" : DATE_TIME_FORMATTER.format(date);
  }

  function titleize(value) {
    return String(value || "")
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/\b\w/g, (match) => match.toUpperCase());
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

  function patientName(caseData = {}, options = {}) {
    if (options.patientName) return options.patientName;
    const patient = caseData?.patient || {};
    const fullName = [patient.firstName, patient.lastName].filter(Boolean).join(" ").trim();
    if (fullName) return fullName;
    const email = patient.user?.email || "";
    return email ? email.split("@")[0] : "Patient";
  }

  function doctorDisplay(caseData = {}) {
    const doctor = caseData?.assignedDoctor;
    if (!doctor) return "No doctor assigned yet";
    const fullName = [doctor.firstName, doctor.lastName].filter(Boolean).join(" ").trim();
    return fullName ? `Dr. ${fullName}` : doctor.user?.email || "Assigned doctor";
  }

  function getCaseImageUrl(caseData = {}) {
    if (Array.isArray(caseData.imageUrls) && caseData.imageUrls.length) return caseData.imageUrls[0];
    if (Array.isArray(caseData.images) && caseData.images.length) {
      const latestImage = [...caseData.images].sort((a, b) => new Date(b.uploadedAt || 0) - new Date(a.uploadedAt || 0))[0];
      if (latestImage?.imageUrl) return latestImage.imageUrl;
    }
    return null;
  }

  function latestImageMeta(caseData = {}) {
    const images = Array.isArray(caseData.images) ? [...caseData.images] : [];
    if (images.length) {
      const latest = images.sort((a, b) => new Date(b.uploadedAt || 0) - new Date(a.uploadedAt || 0))[0];
      return {
        uploadedAt: latest?.uploadedAt ? fmtDate(latest.uploadedAt) : "Upload timestamp unavailable",
        imageUrl: latest?.imageUrl || getCaseImageUrl(caseData),
      };
    }
    return {
      uploadedAt: "Upload timestamp unavailable",
      imageUrl: getCaseImageUrl(caseData),
    };
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

    let guidance = "This context helps tailor intake questions and later review. It does not confirm a diagnosis on its own.";
    if (climate === "HOT_HUMID") {
      guidance = "Heat, sweat, and friction can be relevant context for irritation and moisture-related skin changes.";
    } else if (climate === "DRY_LOW_HUMIDITY") {
      guidance = "Dry conditions can be relevant context when cracking, tightness, or irritation are part of the history.";
    } else if (climate === "DUSTY_POLLUTION") {
      guidance = "Dust and pollution can be useful context when contact irritation or exposure-related flare patterns are suspected.";
    } else if (climate === "RAINY_DAMP") {
      guidance = "Persistent dampness can be relevant context when moisture, occlusion, or friction seem to worsen the area.";
    } else if (climate === "CHANGED_ENVIRONMENT") {
      guidance = "Recent travel or a new environment can be helpful context when symptoms started after a change in routine or exposure.";
    }

    return {
      climate: climate ? environmentLabel(climate) : null,
      exposures: exposures.map(exposureLabel),
      symptomSummary: symptomSelections(caseData).join(", ") || null,
      guidance,
    };
  }

  function recommendedNextStep(caseData = {}) {
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

  function savedAiRecommendation(caseData = {}) {
    const value = caseData?.result?.recommendation;
    return typeof value === "string" && value.trim() ? value.trim() : null;
  }

  function triageLabel(caseData = {}) {
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

  function severityLabel(caseData = {}) {
    const fused = caseData?.mlFusedResult || {};
    const display = fused.display || {};
    return display.severity_text || fused.final_severity_level || fused.severity || "Pending";
  }

  function conditionLabel(caseData = {}) {
    const fused = caseData?.mlFusedResult || {};
    const display = fused.display || {};
    return display.condition_text || "Condition unclear from image";
  }

  function imageAssessment(caseData = {}) {
    return caseData?.mlFusedResult?.display?.image_assessment || "Image review pending";
  }

  function qualityLabel(caseData = {}) {
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

  function getEmergencySupport(caseData = {}) {
    const fused = caseData?.mlFusedResult || {};
    const display = fused.display || {};
    const recommended = fused.recommended_actions || {};
    const fromDisplay = display.emergency_support || {};
    const careLevel = String(recommended.care_level || fused.triage_level || fused.triage || "").toLowerCase();
    const isEmergency =
      fromDisplay.is_emergency === true ||
      display.show_urgent_badge === true ||
      careLevel === "urgent_attention" ||
      caseData?.isEmergency === true;

    const contacts =
      Array.isArray(fromDisplay.contacts) && fromDisplay.contacts.length
        ? fromDisplay.contacts
        : emergencyContacts();

    return {
      isEmergency,
      label: fromDisplay.label || "Urgent care recommended",
      heading: fromDisplay.heading || "Seek immediate medical attention",
      guidanceText:
        fromDisplay.guidance_text ||
        "This screening suggests the case may need immediate medical evaluation. Contact emergency services or go to the nearest hospital now if symptoms are severe or worsening.",
      warningText:
        fromDisplay.warning_text ||
        fused?.recommended_actions?.urgent_warning ||
        fused?.urgent_warning ||
        null,
      contacts,
    };
  }

  function buildDoctorReviewSummary(caseData = {}) {
    const recommendation = caseData?.doctorRecommendation || null;
    const reviewedAt = caseData?.doctorReviewedAt || null;
    return {
      available: hasDoctorReview(caseData),
      doctorName: caseData?.assignedDoctorId ? doctorDisplay(caseData) : "No doctor assigned yet",
      notes: caseData?.doctorNotes || null,
      recommendation,
      severityOverride: reviewSeverityLabel(caseData),
      rawSeverityOverride: String(caseData?.doctorSeverityOverride || "").toLowerCase() || null,
      followUpNeeded:
        caseData?.doctorFollowUpNeeded !== null && caseData?.doctorFollowUpNeeded !== undefined
          ? caseData.doctorFollowUpNeeded
          : null,
      reviewedAt: reviewedAt ? fmtDate(reviewedAt) : null,
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

  function doctorCareLevel({ rawSeverityOverride = "", followUpNeeded = null, fallbackCareLevel = "", hasUrgentRecommendation = false } = {}) {
    const value = String(rawSeverityOverride || "").toLowerCase();
    if (value === "severe" || hasUrgentRecommendation) return "Urgent attention";
    if (value === "moderate" || followUpNeeded === true) return "Priority review";
    if (value === "mild") return "Home care / monitor";
    return fallbackCareLevel || "Home care / monitor";
  }

  function buildDoctorEmergencySupport(doctorReview = {}, nextStep = "") {
    const recommendation = doctorReview.recommendation || nextStep || null;
    const warningText = doctorReview.notes || recommendation || "Seek urgent in-person medical evaluation as soon as possible.";
    return {
      isEmergency: true,
      label: "Doctor recommends urgent care",
      heading: "Seek urgent medical attention",
      guidanceText:
        recommendation ||
        "A doctor reviewed this case and recommends urgent medical attention based on the latest findings.",
      warningText,
      contacts: emergencyContacts(),
    };
  }

  function buildCurrentGuidance(caseData = {}, aiTriage = {}, doctorReview = {}) {
    const updatedAiRecommendation = savedAiRecommendation(caseData);
    const reviewAvailable = Boolean(doctorReview?.available);
    const hasUrgentRecommendation = hasDoctorUrgentRecommendation(doctorReview.recommendation, doctorReview.notes);
    const source = reviewAvailable ? "DOCTOR" : updatedAiRecommendation ? "UPDATED_AI" : "AI";
    const nextStep = doctorReview.recommendation || updatedAiRecommendation || aiTriage.nextStep;
    const severity = doctorReview.severityOverride || aiTriage.severity;
    const careLevel =
      source === "DOCTOR"
        ? doctorCareLevel({
            rawSeverityOverride: doctorReview.rawSeverityOverride,
            followUpNeeded: doctorReview.followUpNeeded,
            fallbackCareLevel: aiTriage.careLevel,
            hasUrgentRecommendation,
          })
        : aiTriage.careLevel;

    const reviewedSuffix = doctorReview.reviewedAt ? ` on ${doctorReview.reviewedAt}` : "";
    const summary =
      source === "DOCTOR"
        ? doctorReview.notes ||
          doctorReview.recommendation ||
          `A doctor reviewed your case${reviewedSuffix} and updated the care guidance below.`
        : source === "UPDATED_AI"
          ? "The saved patient-facing recommendation has been updated for this case."
          : aiTriage.summary;

    const emergency =
      source === "DOCTOR"
        ? doctorReview.rawSeverityOverride === "severe" || hasUrgentRecommendation
          ? buildDoctorEmergencySupport(doctorReview, nextStep)
          : null
        : getEmergencySupport(caseData);

    return {
      source,
      sourceLabel:
        source === "DOCTOR"
          ? "Doctor-reviewed guidance"
          : source === "UPDATED_AI"
            ? "Updated care guidance"
            : "AI triage summary",
      summary,
      imageAssessment: aiTriage.imageAssessment,
      condition: aiTriage.condition,
      severity,
      careLevel,
      nextStep,
      quality: aiTriage.quality,
      emergency: emergency?.isEmergency ? emergency : null,
    };
  }

  function buildHealthReport(caseData = {}, options = {}) {
    const latestImage = latestImageMeta(caseData);
    const doctorReview = buildDoctorReviewSummary(caseData);
    const environmentContext = getEnvironmentContext(caseData);
    const aiTriage = {
      summary: caseData?.mlFusedResult?.ai_summary_text || "AI screening is still processing for this case.",
      imageAssessment: imageAssessment(caseData),
      condition: conditionLabel(caseData),
      severity: severityLabel(caseData),
      careLevel: triageLabel(caseData),
      nextStep: recommendedNextStep(caseData),
      quality: qualityLabel(caseData),
    };
    const currentGuidance = buildCurrentGuidance(caseData, aiTriage, doctorReview);

    return {
      overview: {
        patientName: patientName(caseData, options),
        reference: `Case #${caseData.id}`,
        createdAt: fmtDate(caseData.submittedAt),
        status: caseStatusText(caseData),
        assignedDoctor: caseData?.assignedDoctorId ? doctorDisplay(caseData) : "No doctor assigned yet",
      },
      aiTriage,
      currentGuidance,
      environmentContext,
      emergency: currentGuidance.emergency,
      doctorReview,
      latestImage: {
        uploadedAt: latestImage?.uploadedAt || "Upload timestamp unavailable",
        hasImage: Boolean(latestImage?.imageUrl),
      },
    };
  }

  function monthMatches(caseData = {}, monthValue = "") {
    if (!monthValue) return true;
    const submittedAt = new Date(caseData.submittedAt || "");
    if (Number.isNaN(submittedAt.getTime())) return false;
    const month = `${submittedAt.getFullYear()}-${String(submittedAt.getMonth() + 1).padStart(2, "0")}`;
    return month === monthValue;
  }

  function filterHistoryCases(cases = [], { month = "", doctorReviewedOnly = false } = {}) {
    return (cases || []).filter((caseData) => {
      if (!monthMatches(caseData, month)) return false;
      if (doctorReviewedOnly && !buildDoctorReviewSummary(caseData).available) return false;
      return true;
    });
  }

  function formatMonthLabel(monthValue = "") {
    if (!monthValue) return "All months";
    const [year, month] = monthValue.split("-").map(Number);
    if (!year || !month) return monthValue;
    return new Date(year, month - 1, 1).toLocaleDateString([], { month: "long", year: "numeric" });
  }

  function buildPrintableDocument({
    title,
    subtitle,
    reports = [],
    generatedAt = fmtDate(new Date().toISOString()),
    metadata = [],
  }) {
    const metaChips = metadata.length
      ? `<div class="print-meta">${metadata.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</div>`
      : "";

    const reportMarkup = reports
      .map(({ report }) => {
        const doctorReview = report.doctorReview;
        return `
          <article class="print-report-card">
            <header class="print-report-header">
              <div>
                <div class="print-report-kicker">Structured Triage Report</div>
                <h2>${escapeHtml(report.overview.reference)}</h2>
                <p>${escapeHtml(report.overview.patientName)} | ${escapeHtml(report.overview.createdAt)}</p>
              </div>
              <div class="print-status">${escapeHtml(report.overview.status)}</div>
            </header>

            <section class="print-section">
              <h3>Case Overview</h3>
              <div class="print-grid">
                <div><span>Assigned doctor</span><strong>${escapeHtml(report.overview.assignedDoctor)}</strong></div>
                <div><span>Created</span><strong>${escapeHtml(report.overview.createdAt)}</strong></div>
                <div><span>Status</span><strong>${escapeHtml(report.overview.status)}</strong></div>
                <div><span>Reference</span><strong>${escapeHtml(report.overview.reference)}</strong></div>
              </div>
            </section>

            <section class="print-section">
              <h3>${escapeHtml(report.currentGuidance.sourceLabel)}</h3>
              <div class="print-grid">
                <div><span>Image review</span><strong>${escapeHtml(report.currentGuidance.imageAssessment)}</strong></div>
                <div><span>Possible condition</span><strong>${escapeHtml(report.currentGuidance.condition)}</strong></div>
                <div><span>Current severity</span><strong>${escapeHtml(report.currentGuidance.severity)}</strong></div>
                <div><span>Care level</span><strong>${escapeHtml(report.currentGuidance.careLevel)}</strong></div>
              </div>
              <p>${escapeHtml(report.currentGuidance.summary)}</p>
              <div class="print-note">
                <span>${escapeHtml(report.currentGuidance.source === "DOCTOR" ? "Doctor recommendation" : "Recommended next step")}</span>
                <strong>${escapeHtml(report.currentGuidance.nextStep)}</strong>
              </div>
              ${report.currentGuidance.quality ? `<div class="print-inline">Image quality: ${escapeHtml(report.currentGuidance.quality)}</div>` : ""}
            </section>

            ${
              report.environmentContext
                ? `<section class="print-section">
                    <h3>Environmental Context</h3>
                    <div class="print-grid">
                      <div><span>Climate / environment</span><strong>${escapeHtml(report.environmentContext.climate || "Not provided")}</strong></div>
                      <div><span>Possible trigger context</span><strong>${escapeHtml(
                        report.environmentContext.exposures.length ? report.environmentContext.exposures.join(", ") : "Not provided"
                      )}</strong></div>
                      ${
                        report.environmentContext.symptomSummary
                          ? `<div><span>Reported symptoms</span><strong>${escapeHtml(report.environmentContext.symptomSummary)}</strong></div>`
                          : ""
                      }
                    </div>
                    <div class="print-note">
                      <span>How this is used</span>
                      <strong>${escapeHtml(report.environmentContext.guidance)}</strong>
                    </div>
                  </section>`
                : ""
            }

            ${
              report.emergency
                ? `<section class="print-section print-section--emergency">
                    <h3>Emergency Guidance</h3>
                    <p>${escapeHtml(report.emergency.guidanceText)}</p>
                    ${
                      report.emergency.warningText
                        ? `<div class="print-note print-note--danger">
                            <span>Urgent guidance</span>
                            <strong>${escapeHtml(report.emergency.warningText)}</strong>
                          </div>`
                        : ""
                    }
                    <div class="print-grid">
                      ${report.emergency.contacts
                        .map(
                          (contact) => `<div><span>${escapeHtml(contact.label)}</span><strong>${escapeHtml(contact.number)}</strong></div>`
                        )
                        .join("")}
                    </div>
                  </section>`
                : ""
            }

            <section class="print-section">
              <h3>Doctor Review</h3>
              ${
                doctorReview.available
                  ? `
                    <div class="print-grid">
                      <div><span>Reviewed by</span><strong>${escapeHtml(doctorReview.doctorName)}</strong></div>
                      <div><span>Reviewed at</span><strong>${escapeHtml(doctorReview.reviewedAt || "Pending")}</strong></div>
                      <div><span>Doctor-reviewed severity</span><strong>${escapeHtml(doctorReview.severityOverride || "Not specified")}</strong></div>
                      <div><span>Follow-up needed</span><strong>${escapeHtml(
                        doctorReview.followUpNeeded === null ? "Not specified" : doctorReview.followUpNeeded ? "Yes" : "No"
                      )}</strong></div>
                    </div>
                    ${doctorReview.notes ? `<div class="print-note"><span>Notes</span><strong>${escapeHtml(doctorReview.notes)}</strong></div>` : ""}
                    ${
                      doctorReview.recommendation
                        ? `<div class="print-note"><span>Recommendation</span><strong>${escapeHtml(doctorReview.recommendation)}</strong></div>`
                        : ""
                    }
                  `
                  : `<div class="print-empty">No doctor review has been added yet.</div>`
              }
            </section>

            <section class="print-section">
              <h3>Latest Uploaded Image</h3>
              <div class="print-grid">
                <div><span>Evidence status</span><strong>${escapeHtml(report.latestImage.hasImage ? "Latest image on file" : "No image on file")}</strong></div>
                <div><span>Uploaded</span><strong>${escapeHtml(report.latestImage.uploadedAt)}</strong></div>
              </div>
            </section>
          </article>
        `;
      })
      .join("");

    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
    :root {
      color-scheme: light;
      --ec-primary: #2563eb;
      --ec-accent: #14b8a6;
      --ec-bg: #f8fafc;
      --ec-border: #e2e8f0;
      --ec-text: #0f172a;
      --ec-muted: #64748b;
      --ec-danger: #b91c1c;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Segoe UI", Arial, sans-serif;
      background: linear-gradient(180deg, #f8fbff 0%, var(--ec-bg) 100%);
      color: var(--ec-text);
    }
    .print-shell {
      max-width: 900px;
      margin: 0 auto;
      padding: 32px 24px 48px;
    }
    .print-toolbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      margin-bottom: 24px;
      padding: 14px 18px;
      border: 1px solid var(--ec-border);
      border-radius: 18px;
      background: rgba(255,255,255,0.92);
    }
    .print-toolbar h1 {
      margin: 0;
      font-size: 28px;
      letter-spacing: -0.03em;
    }
    .print-toolbar p {
      margin: 6px 0 0;
      color: var(--ec-muted);
    }
    .print-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 12px;
    }
    .print-meta span {
      padding: 6px 10px;
      border-radius: 999px;
      background: rgba(37, 99, 235, 0.08);
      color: var(--ec-primary);
      font-size: 12px;
      font-weight: 700;
    }
    .print-actions {
      display: flex;
      gap: 10px;
    }
    .print-actions button {
      border: 1px solid var(--ec-border);
      border-radius: 12px;
      padding: 10px 14px;
      font-weight: 700;
      cursor: pointer;
      background: white;
      color: var(--ec-text);
    }
    .print-actions button.primary {
      border-color: transparent;
      background: linear-gradient(135deg, var(--ec-primary), var(--ec-accent));
      color: white;
    }
    .print-report-card {
      margin-top: 22px;
      padding: 24px;
      border-radius: 24px;
      border: 1px solid var(--ec-border);
      background: rgba(255,255,255,0.96);
      box-shadow: 0 18px 36px rgba(15, 23, 42, 0.06);
      break-inside: avoid;
    }
    .print-report-header {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      align-items: flex-start;
    }
    .print-report-kicker {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: var(--ec-primary);
    }
    .print-report-header h2 {
      margin: 8px 0 6px;
      font-size: 24px;
      letter-spacing: -0.02em;
    }
    .print-report-header p {
      margin: 0;
      color: var(--ec-muted);
      overflow-wrap: anywhere;
    }
    .print-status {
      padding: 8px 12px;
      border-radius: 999px;
      background: rgba(37, 99, 235, 0.08);
      color: var(--ec-primary);
      font-size: 12px;
      font-weight: 700;
    }
    .print-section {
      margin-top: 20px;
      padding-top: 20px;
      border-top: 1px solid var(--ec-border);
    }
    .print-section--emergency {
      padding: 18px;
      border: 1px solid rgba(245, 158, 11, 0.22);
      border-radius: 18px;
      background: linear-gradient(180deg, rgba(255, 251, 235, 0.95), rgba(255, 247, 237, 0.98));
    }
    .print-section h3 {
      margin: 0 0 12px;
      font-size: 16px;
    }
    .print-section p {
      margin: 0;
      line-height: 1.65;
      overflow-wrap: anywhere;
    }
    .print-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
    }
    .print-grid > div {
      border: 1px solid rgba(37, 99, 235, 0.08);
      border-radius: 16px;
      background: rgba(248, 251, 255, 0.96);
      padding: 12px 14px;
    }
    .print-grid span,
    .print-note span {
      display: block;
      margin-bottom: 6px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--ec-muted);
    }
    .print-grid strong,
    .print-note strong {
      line-height: 1.55;
      overflow-wrap: anywhere;
      white-space: pre-wrap;
    }
    .print-note {
      margin-top: 12px;
      padding: 14px 16px;
      border-radius: 16px;
      border: 1px solid var(--ec-border);
      background: rgba(248, 251, 255, 0.92);
    }
    .print-note--danger {
      border-color: rgba(239, 68, 68, 0.18);
      background: rgba(254, 242, 242, 0.92);
    }
    .print-inline {
      margin-top: 10px;
      color: var(--ec-muted);
      font-size: 13px;
    }
    .print-empty {
      padding: 14px 16px;
      border-radius: 16px;
      border: 1px dashed rgba(148, 163, 184, 0.56);
      color: var(--ec-muted);
    }
    @media print {
      body { background: white; }
      .print-shell { max-width: none; padding: 0; }
      .print-toolbar { display: none; }
      .print-report-card { box-shadow: none; margin-top: 16px; }
    }
    @media (max-width: 720px) {
      .print-grid { grid-template-columns: 1fr; }
      .print-report-header,
      .print-toolbar { flex-direction: column; align-items: flex-start; }
    }
  </style>
</head>
<body>
  <div class="print-shell">
    <div class="print-toolbar">
      <div>
        <h1>${escapeHtml(title)}</h1>
        <p>${escapeHtml(subtitle)}</p>
        <div class="print-inline">Prepared ${escapeHtml(generatedAt)}</div>
        ${metaChips}
      </div>
      <div class="print-actions">
        <button class="primary" onclick="window.print()">Print / Save as PDF</button>
        <button onclick="window.close()">Close</button>
      </div>
    </div>
    ${reportMarkup}
  </div>
</body>
</html>`;
  }

  function buildReportRouteUrl(mode, options = {}) {
    const params = new URLSearchParams();
    params.set("mode", mode);
    if (options.caseId) params.set("caseId", String(options.caseId));
    if (options.month) params.set("month", String(options.month));
    if (options.doctorReviewedOnly) params.set("doctorReviewedOnly", "1");
    return `/patient-report.html?${params.toString()}`;
  }

  function openReportWindow(url) {
    const exportWindow = window.open(url, "_blank", "width=1180,height=900");
    if (!exportWindow) {
      throw new Error("Popup blocked. Please allow popups to export the report.");
    }
    exportWindow.focus();
    return exportWindow;
  }

  function exportCurrentCaseReport(caseData, options = {}) {
    if (!caseData?.id) {
      throw new Error("A saved case is required before opening the report.");
    }
    return openReportWindow(buildReportRouteUrl("current", { caseId: caseData.id, ...options }));
  }

  function exportHistoryReports(cases = [], options = {}) {
    const filtered = filterHistoryCases(cases, options);
    if (!filtered.length) return { exported: false, filtered };
    openReportWindow(buildReportRouteUrl("history", options));
    return { exported: true, filtered };
  }

  window.EdgeCareReports = {
    escapeHtml,
    fmtDate,
    titleize,
    hasDoctorReview,
    reviewSeverityLabel,
    getEnvironmentContext,
    getCaseImageUrl,
    getEmergencySupport,
    buildDoctorReviewSummary,
    buildHealthReport,
    buildCurrentGuidance,
    buildPrintableDocument,
    filterHistoryCases,
    formatMonthLabel,
    exportCurrentCaseReport,
    exportHistoryReports,
  };
})();
