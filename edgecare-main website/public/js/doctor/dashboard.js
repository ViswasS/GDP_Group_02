requireDoctorAuth();

const casesList = document.getElementById("casesList");
const emptyState = document.getElementById("emptyState");
const searchEl = document.getElementById("search");
const statusFilter = document.getElementById("statusFilter");
const refreshBtn = document.getElementById("refreshBtn");
const logoutBtn = document.getElementById("logoutBtn");
const meLabel = document.getElementById("meLabel");
const out = document.getElementById("out");

const kpiAssigned = document.getElementById("kpiAssigned");
const kpiInReview = document.getElementById("kpiInReview");
const kpiClosed = document.getElementById("kpiClosed");
const DATE_TIME_FORMATTER = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

let allCases = [];

function isUrgentCase(caseData = {}) {
  const fused = caseData?.mlFusedResult || {};
  const display = fused.display || {};
  const recommended = fused.recommended_actions || {};
  const careLevel = String(recommended.care_level || fused.triage_level || fused.triage || "").toLowerCase();
  return (
    display?.emergency_support?.is_emergency === true ||
    display.show_urgent_badge === true ||
    careLevel === "urgent_attention" ||
    caseData?.isEmergency === true
  );
}

function show(obj) {
  out.style.display = "block";
  out.textContent = typeof obj === "string" ? obj : JSON.stringify(obj, null, 2);
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

function patientDisplay(caseData = {}) {
  const patient = caseData?.patient || {};
  const fullName = [patient.firstName, patient.lastName].filter(Boolean).join(" ").trim();
  if (fullName) return fullName;
  return patient.user?.email || "Patient";
}

function doctorIdentity(user = {}) {
  const fallbackEmail = user?.email || "";
  return fallbackEmail ? fallbackEmail.split("@")[0] : "Doctor";
}

function setDoctorIdentity(user = {}) {
  if (!meLabel) return;
  meLabel.innerHTML = `
    <span class="user-chip__primary">${escapeHtml(doctorIdentity(user))}</span>
    <span class="user-chip__role">Doctor</span>
  `;
}

function computeKpis(items) {
  const assigned = items.length;
  const inReview = items.filter((item) => item.status === "IN_REVIEW").length;
  const closed = items.filter((item) => item.status === "CLOSED").length;

  kpiAssigned.textContent = String(assigned);
  kpiInReview.textContent = String(inReview);
  kpiClosed.textContent = String(closed);
}

function render(items) {
  casesList.innerHTML = "";

  if (!items.length) {
    emptyState.style.display = "block";
    return;
  }
  emptyState.style.display = "none";

  for (const caseData of items) {
    const title = caseData.intake?.title || `Case #${caseData.id}`;
    const patientName = patientDisplay(caseData);
    const patientEmail = caseData.patient?.user?.email || "";
    const urgent = isUrgentCase(caseData);
    const emergency = urgent ? '<span class="badge emergency">Urgent</span>' : "";
    const hasResult = caseData.result ? '<span class="badge result">Doctor Reviewed</span>' : "";

    const el = document.createElement("div");
    el.className = `list-row ${urgent ? "list-row--urgent" : ""}`.trim();
    el.innerHTML = `
      <div class="avatar avatar-sm">${escapeHtml(patientName[0] || "P").toUpperCase()}</div>
      <div class="list-main">
        <div class="list-title">${escapeHtml(title)}</div>
        <div class="list-meta">
          <span>Case #${caseData.id}</span>
          <span>Patient: ${escapeHtml(patientName)}</span>
          <span>${escapeHtml(fmtDate(caseData.submittedAt))}</span>
          ${patientEmail && patientEmail !== patientName ? `<span>${escapeHtml(patientEmail)}</span>` : ""}
          ${urgent ? '<span class="list-meta-urgent">Immediate medical evaluation may be needed</span>' : ""}
        </div>
      </div>
      <div class="item-right">
        ${statusBadge(caseData.status)}
        ${emergency}
        ${hasResult}
        <button class="btn primary" data-open="${caseData.id}">Open</button>
      </div>
    `;
    casesList.appendChild(el);
  }

  casesList.querySelectorAll("button[data-open]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-open");
      window.location.href = `/doctor-case.html?id=${id}`;
    });
  });
}

function applyFilters() {
  const query = (searchEl.value || "").toLowerCase().trim();
  const status = statusFilter.value;

  let items = [...allCases];

  if (status) items = items.filter((caseData) => caseData.status === status);

  if (query) {
    items = items.filter((caseData) => {
      const title = (caseData.intake?.title || "").toLowerCase();
      const patientName = patientDisplay(caseData).toLowerCase();
      const patientEmail = (caseData.patient?.user?.email || "").toLowerCase();
      const id = String(caseData.id);
      return title.includes(query) || patientName.includes(query) || patientEmail.includes(query) || id.includes(query);
    });
  }

  render(items);
}

async function loadMe() {
  const me = await apiFetch("/users/me", { method: "GET" });
  setDoctorIdentity(me?.data || {});
}

async function loadCases() {
  out.style.display = "none";
  const resp = await apiFetch("/cases", { method: "GET" });
  allCases = resp.data || [];
  computeKpis(allCases);
  applyFilters();
}

logoutBtn.addEventListener("click", () => logout("/doctor-login.html?role=DOCTOR"));

refreshBtn.addEventListener("click", loadCases);
searchEl.addEventListener("input", applyFilters);
statusFilter.addEventListener("change", applyFilters);

(async function init() {
  try {
    await loadMe();
    await loadCases();
  } catch (e) {
    show({ message: e.message, status: e.status, payload: e.payload });
  }
})();
