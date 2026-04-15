requirePatientAuth();

const caseList = document.getElementById("caseList");
const meLabel = document.getElementById("meLabel");
const logoutBtn = document.getElementById("logoutBtn");
const out = document.getElementById("out");
const historyMonthFilter = document.getElementById("historyMonthFilter");
const historyDoctorReviewedOnly = document.getElementById("historyDoctorReviewedOnly");
const historyExportBtn = document.getElementById("historyExportBtn");
const historyClearFiltersBtn = document.getElementById("historyClearFiltersBtn");
const historyExportSummary = document.getElementById("historyExportSummary");
const reportUtils = window.EdgeCareReports;
const DATE_TIME_FORMATTER = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

const state = {
  profile: null,
  allCases: [],
  exporting: false,
};

function showDebug(obj) {
  if (!out) return;
  out.style.display = "block";
  out.textContent = typeof obj === "string" ? obj : JSON.stringify(obj, null, 2);
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

function statusBadge(status) {
  const value = String(status || "").toUpperCase();
  if (value === "SUBMITTED") return '<span class="badge submitted">AI Support Active</span>';
  if (value === "IN_REVIEW") return '<span class="badge review">In Review</span>';
  if (value === "CLOSED") return '<span class="badge closed">Closed</span>';
  return `<span class="badge">${escapeHtml(value || "UNKNOWN")}</span>`;
}

function fmtDate(iso) {
  if (!iso) return "-";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "-" : DATE_TIME_FORMATTER.format(date);
}

function doctorDisplay(caseData = {}) {
  const doctor = caseData?.assignedDoctor;
  if (!doctor) return "AI Support Active";
  const fullName = [doctor.firstName, doctor.lastName].filter(Boolean).join(" ").trim();
  return fullName ? `Dr. ${fullName}` : doctor.user?.email || "Assigned doctor";
}

function renderList(items = []) {
  if (!caseList) return;
  if (!items.length) {
    caseList.innerHTML = `<div class="empty-state"><strong>No cases yet</strong><span>Create a case to start AI Support Active and track doctor updates here.</span></div>`;
    return;
  }

  const frag = document.createDocumentFragment();
  items.forEach((caseData) => {
    const row = document.createElement("div");
    const urgent = Boolean(caseData?.isEmergency || caseData?.mlFusedResult?.display?.show_urgent_badge);
    row.className = urgent ? "list-row list-row--urgent" : "list-row";
    row.addEventListener("click", () => {
      window.location.href = `/patient-case.html?id=${caseData.id}`;
    });

    const avatar = document.createElement("div");
    avatar.className = "avatar avatar-sm";
    avatar.textContent = (caseData.patient?.user?.email || "P")[0]?.toUpperCase() || "P";

    const main = document.createElement("div");
    main.className = "list-main";

    const title = document.createElement("div");
    title.className = "list-title";
    title.textContent = caseData.intake?.title || `Case #${caseData.id}`;

    const meta = document.createElement("div");
    meta.className = "list-meta";
    meta.innerHTML = `
      <span>Case #${caseData.id}</span>
      <span>${escapeHtml(fmtDate(caseData.submittedAt))}</span>
      <span>${escapeHtml(doctorDisplay(caseData))}</span>
      ${urgent ? '<span class="list-meta-urgent">Urgent care flag</span>' : ""}
    `;

    main.append(title, meta);

    const right = document.createElement("div");
    right.className = "item-right";
    right.innerHTML = `${statusBadge(caseData.status)} <span class="chevron">></span>`;

    row.append(avatar, main, right);
    frag.appendChild(row);
  });

  caseList.innerHTML = "";
  caseList.appendChild(frag);
}

function currentFilters() {
  return {
    month: historyMonthFilter?.value || "",
    doctorReviewedOnly: Boolean(historyDoctorReviewedOnly?.checked),
  };
}

function filteredCases() {
  return reportUtils.filterHistoryCases(state.allCases, currentFilters());
}

function updateHistorySummary(items = []) {
  if (!historyExportSummary) return;
  const filters = currentFilters();
  const parts = [];
  if (filters.month) parts.push(reportUtils.formatMonthLabel(filters.month));
  else parts.push("All months");
  if (filters.doctorReviewedOnly) parts.push("doctor-reviewed only");
  const summaryLabel = parts.join(" | ");
  historyExportSummary.textContent = items.length
    ? `Showing ${items.length} case${items.length === 1 ? "" : "s"} for ${summaryLabel}.`
    : `No cases match ${summaryLabel}.`;
}

function applyFilters() {
  const items = filteredCases();
  renderList(items);
  updateHistorySummary(items);
}

async function exportHistory() {
  const items = filteredCases();
  if (!items.length) {
    toast?.warn?.("No cases match the selected export filters.");
    updateHistorySummary(items);
    return;
  }

  try {
    state.exporting = true;
    if (historyExportBtn) historyExportBtn.textContent = "Preparing report...";
    reportUtils.exportHistoryReports(items, {
      ...currentFilters(),
      patientName: patientDisplayName(state.profile || {}),
    });
    toast?.success?.("Report export opened. Use Print / Save as PDF to download it.");
  } catch (error) {
    toast?.error?.(error?.message || "Unable to open the report export");
  } finally {
    state.exporting = false;
    if (historyExportBtn) historyExportBtn.textContent = "Export report";
  }
}

async function loadMe() {
  const profile = await apiFetch("/patient/profile", { method: "GET" }, { loginPath: "/patient-login.html" });
  state.profile = profile?.data || null;
  setPatientIdentity(profile?.data || {});
}

async function loadCases() {
  try {
    const res = await apiFetch("/cases", { method: "GET" }, { loginPath: "/patient-login.html" });
    state.allCases = res?.data || [];
    applyFilters();
  } catch (e) {
    showDebug({ message: e.message, status: e.status, payload: e.payload });
    if (caseList) {
      caseList.innerHTML = `<div class="empty-state empty-state--error"><strong>Unable to load cases</strong><span>${escapeHtml(e?.message || "Try refreshing the page.")}</span></div>`;
    }
  }
}

logoutBtn?.addEventListener("click", () => logout("/patient-login.html?role=PATIENT"));
historyMonthFilter?.addEventListener("change", applyFilters);
historyDoctorReviewedOnly?.addEventListener("change", applyFilters);
historyExportBtn?.addEventListener("click", exportHistory);
historyClearFiltersBtn?.addEventListener("click", () => {
  if (historyMonthFilter) historyMonthFilter.value = "";
  if (historyDoctorReviewedOnly) historyDoctorReviewedOnly.checked = false;
  applyFilters();
});

(async function init() {
  await loadMe();
  await loadCases();
})();
