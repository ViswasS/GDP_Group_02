requireAdminAuth();

const logoutBtn = document.getElementById("logoutBtn");
const refreshBtn = document.getElementById("refreshBtn");

const overviewStatus = document.getElementById("overviewStatus");
const doctorStatus = document.getElementById("doctorStatus");
const patientStatus = document.getElementById("patientStatus");

const doctorEmpty = document.getElementById("doctorEmpty");
const patientEmpty = document.getElementById("patientEmpty");

const doctorTbody = document.getElementById("doctorTbody");
const patientTbody = document.getElementById("patientTbody");

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function setStatus(el, msg) {
  if (!el) return;
  el.textContent = msg || "";
}

function renderOverview(data) {
  const totals = data?.totals || {};
  const load = data?.doctorLoad || {};
  const set = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value ?? "-";
  };

  set("statDoctors", totals.doctors ?? 0);
  set("statPatients", totals.patients ?? 0);
  set("statCases", totals.cases ?? 0);
  set("statOpen", totals.openCases ?? 0);
  set("statClosed", totals.closedCases ?? 0);
  set("statUnassigned", totals.unassignedOpenCases ?? 0);
  set("statLoadMin", load.min ?? 0);
  set("statLoadAvg", load.avg ?? 0);
  set("statLoadMax", load.max ?? 0);
}

function renderDoctorRows(rows = []) {
  if (!doctorTbody) return;
  if (!rows.length) {
    doctorTbody.innerHTML = "";
    if (doctorEmpty) doctorEmpty.style.display = "block";
    return;
  }
  if (doctorEmpty) doctorEmpty.style.display = "none";

  doctorTbody.innerHTML = rows
    .map((d) => {
      const name = `${escapeHtml(d.firstName || "")} ${escapeHtml(d.lastName || "")}`.trim() || `Doctor #${d.doctorId}`;
      return `
        <tr>
          <td>${name}</td>
          <td>${escapeHtml(d.specialty || "-")}</td>
          <td><span class="badge-pill">${escapeHtml(d.experience ?? 0)} yrs</span></td>
          <td>${escapeHtml(d.activeCaseCount ?? 0)}</td>
          <td>${escapeHtml(d.totalCaseCount ?? 0)}</td>
        </tr>
      `;
    })
    .join("");
}

function renderPatientRows(rows = []) {
  if (!patientTbody) return;
  if (!rows.length) {
    patientTbody.innerHTML = "";
    if (patientEmpty) patientEmpty.style.display = "block";
    return;
  }
  if (patientEmpty) patientEmpty.style.display = "none";

  patientTbody.innerHTML = rows
    .map((p) => {
      const name = `${escapeHtml(p.firstName || "")} ${escapeHtml(p.lastName || "")}`.trim() || `Patient #${p.patientId}`;
      const latestCase = p.latestCaseId ? `#${escapeHtml(p.latestCaseId)} (${escapeHtml(p.latestCaseStatus || "-")})` : "—";
      const latestDoctor = p.latestAssignedDoctor
        ? `${escapeHtml(p.latestAssignedDoctor.firstName || "")} ${escapeHtml(p.latestAssignedDoctor.lastName || "")}`.trim() ||
          `Doctor #${escapeHtml(p.latestAssignedDoctor.doctorId)}`
        : "Unassigned";
      return `
        <tr>
          <td>${name}</td>
          <td>${escapeHtml(p.totalCases ?? 0)}</td>
          <td>${escapeHtml(p.openCases ?? 0)}</td>
          <td>${latestCase}</td>
          <td>${latestDoctor}</td>
        </tr>
      `;
    })
    .join("");
}

async function loadOverview() {
  setStatus(overviewStatus, "Loading...");
  try {
    const res = await apiFetch("/admin/insights/overview");
    renderOverview(res.data || {});
    setStatus(overviewStatus, "");
  } catch (e) {
    setStatus(overviewStatus, "Unable to load overview");
    toast?.error?.(e.message || "Failed to load overview");
  }
}

async function loadDoctors() {
  setStatus(doctorStatus, "Loading...");
  try {
    const res = await apiFetch("/admin/insights/doctors");
    renderDoctorRows(res.data || []);
    setStatus(doctorStatus, "");
  } catch (e) {
    setStatus(doctorStatus, "Unable to load doctors");
    toast?.error?.(e.message || "Failed to load doctor stats");
  }
}

async function loadPatients() {
  setStatus(patientStatus, "Loading...");
  try {
    const res = await apiFetch("/admin/insights/patients");
    renderPatientRows(res.data || []);
    setStatus(patientStatus, "");
  } catch (e) {
    setStatus(patientStatus, "Unable to load patients");
    toast?.error?.(e.message || "Failed to load patient stats");
  }
}

async function refreshAll() {
  await Promise.all([loadOverview(), loadDoctors(), loadPatients()]);
}

logoutBtn?.addEventListener("click", () => {
  clearSession();
  window.location.href = "/admin/index.html";
});

refreshBtn?.addEventListener("click", refreshAll);

refreshAll();
