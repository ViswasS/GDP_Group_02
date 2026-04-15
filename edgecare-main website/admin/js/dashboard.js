requireAdminAuth();

const logoutBtn = document.getElementById("logoutBtn");
const refreshBtn = document.getElementById("refreshBtn");
const meLabel = document.getElementById("meLabel");
const dashboardStatus = document.getElementById("dashboardStatus");
const heroChips = document.getElementById("heroChips");
const kpiGrid = document.getElementById("kpiGrid");
const statusBreakdown = document.getElementById("statusBreakdown");
const workflowGrid = document.getElementById("workflowGrid");
const triageInsights = document.getElementById("triageInsights");
const doctorWorkloadBody = document.getElementById("doctorWorkloadBody");
const doctorWorkloadEmpty = document.getElementById("doctorWorkloadEmpty");
const queuePreview = document.getElementById("queuePreview");
const recentCases = document.getElementById("recentCases");
const DATE_TIME_FORMATTER = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function fmtDate(iso) {
  if (!iso) return "-";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "-" : DATE_TIME_FORMATTER.format(date);
}

function patientOrAdminName(profile = {}) {
  const admin = profile?.adminProfile || {};
  const fullName = [admin.firstName, admin.lastName].filter(Boolean).join(" ").trim();
  if (fullName) return fullName;
  const email = profile?.email || "";
  return email ? email.split("@")[0] : "Admin";
}

function setAdminIdentity(profile = {}) {
  if (!meLabel) return;
  meLabel.innerHTML = `
    <span class="user-chip__primary">${escapeHtml(patientOrAdminName(profile))}</span>
    <span class="user-chip__role">Admin</span>
  `;
}

function setDashboardStatus(message) {
  if (dashboardStatus) dashboardStatus.textContent = message || "";
}

function badgeMarkup(label, variant = "soft") {
  const className = variant === "emergency" ? "badge emergency" : variant === "review" ? "badge review" : "badge-soft";
  return `<span class="${className}">${escapeHtml(label)}</span>`;
}

function formatStatusLabel(value = "") {
  const normalized = String(value || "").toUpperCase();
  if (normalized === "SUBMITTED") return "AI Support Active";
  if (normalized === "IN_REVIEW") return "In Review";
  if (normalized === "CLOSED") return "Closed";
  return String(value || "Case");
}

function formatCareLevelLabel(value = "") {
  const normalized = String(value || "").toLowerCase();
  if (!normalized) return "AI Support Active";
  if (normalized === "urgent_attention") return "Urgent";
  if (normalized === "priority_review") return "Priority review";
  if (normalized === "routine_review") return "Routine review";
  return value;
}

function renderHeroChips(summary = {}, workflow = {}) {
  if (!heroChips) return;
  heroChips.innerHTML = [
    `${summary.totalPatients || 0} patients`,
    `${summary.totalDoctors || 0} doctors`,
    `${summary.totalCases || 0} total cases`,
    `${workflow.doctorReviewRequestedCases || 0} doctor review requests`,
  ]
    .map((label) => `<span class="admin-chip">${escapeHtml(label)}</span>`)
    .join("");
}

function renderKpis(summary = {}) {
  if (!kpiGrid) return;
  const items = [
    { label: "Total Patients", value: summary.totalPatients, meta: "Registered patient profiles" },
    { label: "Total Doctors", value: summary.totalDoctors, meta: "Doctor supply across the portal" },
    { label: "Total Cases", value: summary.totalCases, meta: "All cases ever submitted" },
    { label: "Open Cases", value: summary.openCases, meta: "Submitted or in-review cases" },
    { label: "AI Support Active", value: summary.submittedCases, meta: "Cases still in the AI-first support lane" },
    { label: "In Review", value: summary.inReviewCases, meta: "Doctor-assigned active cases" },
    { label: "Closed Cases", value: summary.closedCases, meta: "Completed cases" },
    { label: "Urgent Cases", value: summary.urgentCases, meta: "Cases flagged for urgent attention" },
    { label: "AI-first Cases", value: summary.aiFirstCases, meta: "Unassigned AI-handled cases" },
  ];

  kpiGrid.innerHTML = items
    .map(
      (item) => `
        <article class="kpi-card">
          <span class="kpi-card__label">${escapeHtml(item.label)}</span>
          <span class="kpi-card__value">${escapeHtml(item.value ?? 0)}</span>
          <span class="kpi-card__meta">${escapeHtml(item.meta)}</span>
        </article>
      `
    )
    .join("");
}

function renderStatusBreakdown(rows = []) {
  if (!statusBreakdown) return;
  statusBreakdown.innerHTML = rows.length
    ? rows
        .map(
          (row) => `
            <div class="breakdown-item">
              <div class="breakdown-item__meta">
                <strong>${escapeHtml(formatStatusLabel(row.label))}</strong>
                <span>${escapeHtml(row.count)} • ${escapeHtml(row.percentage)}%</span>
              </div>
              <div class="breakdown-track">
                <div class="breakdown-fill" style="width:${Math.max(4, Number(row.percentage) || 0)}%"></div>
              </div>
            </div>
          `
        )
        .join("")
    : `<div class="empty-state">No case status data is available yet.</div>`;
}

function renderWorkflow(workflow = {}) {
  if (!workflowGrid) return;
  const items = [
    { label: "AI Support Active", value: workflow.aiFirstUnassignedCases },
    { label: "Doctor assigned", value: workflow.doctorAssignedCases },
    { label: "Doctor reviewed", value: workflow.doctorReviewedCases },
    { label: "Doctor review requested", value: workflow.doctorReviewRequestedCases },
    { label: "Re-uploaded images", value: workflow.reuploadedImageCases },
  ];

  workflowGrid.innerHTML = items
    .map(
      (item) => `
        <div class="workflow-item">
          <strong>${escapeHtml(item.value ?? 0)}</strong>
          <span>${escapeHtml(item.label)}</span>
        </div>
      `
    )
    .join("");
}

function renderTriageInsights(data = {}) {
  if (!triageInsights) return;
  const items = [
    { label: "Clear / non-rash", value: data.clearNonRashCases, meta: "Cases where AI suggests no obvious rash or clear-skin style outcome" },
    { label: "Uncertain cases", value: data.uncertainCases, meta: "Low-confidence or unclear AI triage outcomes" },
    { label: "Doctor review requested", value: data.doctorReviewRequestedCases, meta: "Cases where patients asked for human review" },
    { label: "Re-uploaded images", value: data.reuploadedImageCases, meta: "Cases with a replacement image or multiple uploaded versions" },
    { label: "Urgent AI flags", value: data.urgentCases, meta: "Cases with urgent or emergency-style AI support state" },
    { label: "ML completed", value: data.mlCompletedCases, meta: "Cases with completed AI triage persistence" },
  ];

  triageInsights.innerHTML = items
    .map(
      (item) => `
        <article class="insight-card">
          <span class="insight-card__label">${escapeHtml(item.label)}</span>
          <span class="insight-card__value">${escapeHtml(item.value ?? 0)}</span>
          <span class="insight-card__meta">${escapeHtml(item.meta)}</span>
        </article>
      `
    )
    .join("");
}

function renderDoctorWorkload(rows = []) {
  if (!doctorWorkloadBody) return;
  if (!rows.length) {
    doctorWorkloadBody.innerHTML = "";
    if (doctorWorkloadEmpty) doctorWorkloadEmpty.style.display = "block";
    return;
  }

  if (doctorWorkloadEmpty) doctorWorkloadEmpty.style.display = "none";
  doctorWorkloadBody.innerHTML = rows
    .map(
      (row) => `
        <tr>
          <td>
            <div class="metric-stack">
              <strong>${escapeHtml(row.doctorName)}</strong>
              <span>${escapeHtml(row.specialty || "General review")} • ${escapeHtml(row.experience ?? 0)} yrs</span>
            </div>
          </td>
          <td>${escapeHtml(row.activeAssignedCases ?? 0)} / ${escapeHtml(row.assignedCases ?? 0)}</td>
          <td>${escapeHtml(row.urgentAssignedCases ?? 0)}</td>
          <td>${escapeHtml(row.reviewedCases ?? 0)}</td>
          <td>${escapeHtml(row.closedCases ?? 0)}</td>
        </tr>
      `
    )
    .join("");
}

function renderMiniCaseList(target, rows = [], { emptyMessage = "No cases to show." } = {}) {
  if (!target) return;
  if (!rows.length) {
    target.innerHTML = `<div class="empty-state">${escapeHtml(emptyMessage)}</div>`;
    return;
  }

  target.innerHTML = rows
    .map(
      (row) => `
        <article class="recent-case ${row.urgent ? "recent-case--urgent" : ""}">
          <div>
            <h3 class="recent-case__title">${escapeHtml(row.title)}</h3>
            <div class="recent-case__meta">
              <span>${escapeHtml(row.patientName)}</span>
              <span>${escapeHtml(row.assignedDoctorName || "Unassigned")}</span>
              <span>${escapeHtml(formatCareLevelLabel(row.careLevel))}</span>
            </div>
          </div>
          <div class="recent-case__right">
            <div class="badge-cluster">
              ${row.urgent ? badgeMarkup("Urgent", "emergency") : ""}
              ${badgeMarkup(formatStatusLabel(row.statusLabel || row.status || "Case"))}
              ${row.aiFirst ? badgeMarkup("AI Support Active") : ""}
            </div>
            <span class="admin-status">${escapeHtml(fmtDate(row.submittedAt))}</span>
          </div>
        </article>
      `
    )
    .join("");
}

async function loadMe() {
  try {
    const response = await apiFetch("/users/me");
    setAdminIdentity(response?.data || {});
  } catch (_) {
    if (meLabel) meLabel.textContent = "Admin";
  }
}

async function loadDashboard() {
  setDashboardStatus("Loading dashboard data...");
  try {
    const response = await apiFetch("/admin/insights/dashboard");
    const data = response?.data || {};

    renderHeroChips(data.summary, data.workflow);
    renderKpis(data.summary || {});
    renderStatusBreakdown(data.statusBreakdown || []);
    renderWorkflow(data.workflow || {});
    renderTriageInsights(data.triageInsights || {});
    renderDoctorWorkload(data.doctorWorkload || []);
    renderMiniCaseList(queuePreview, data.queuePreview || [], {
      emptyMessage: "No AI-first unassigned cases are waiting right now.",
    });
    renderMiniCaseList(recentCases, data.recentCases || [], {
      emptyMessage: "No recent cases are available yet.",
    });

    setDashboardStatus(`Updated ${fmtDate(new Date().toISOString())}`);
  } catch (error) {
    setDashboardStatus("Unable to load dashboard");
    toast?.error?.(error?.message || "Failed to load admin dashboard");
    if (kpiGrid) kpiGrid.innerHTML = `<div class="empty-state">Unable to load dashboard metrics right now.</div>`;
  }
}

logoutBtn?.addEventListener("click", () => {
  clearSession();
  window.location.href = "/admin/index.html";
});

refreshBtn?.addEventListener("click", loadDashboard);

(async function init() {
  await loadMe();
  await loadDashboard();
})();
