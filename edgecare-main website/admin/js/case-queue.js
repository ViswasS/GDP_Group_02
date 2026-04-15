requireAdminAuth();

const caseList = document.getElementById("caseList");
const empty = document.getElementById("empty");
const modalBackdrop = document.getElementById("modalBackdrop");
const doctorSelect = document.getElementById("doctorSelect");
const assignBtn = document.getElementById("assignBtn");
const closeBtn = document.getElementById("closeBtn");
const logoutBtn = document.getElementById("logoutBtn");
const refreshBtn = document.getElementById("refreshBtn");
const queueStatus = document.getElementById("queueStatus");
const meLabel = document.getElementById("meLabel");
const DATE_TIME_FORMATTER = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

let selectedCaseId = null;
let doctors = [];

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

function adminDisplayName(profile = {}) {
  const admin = profile?.adminProfile || {};
  const fullName = [admin.firstName, admin.lastName].filter(Boolean).join(" ").trim();
  if (fullName) return fullName;
  const email = profile?.email || "";
  return email ? email.split("@")[0] : "Admin";
}

function patientDisplay(caseData = {}) {
  const patient = caseData?.patient || {};
  const fullName = [patient.firstName, patient.lastName].filter(Boolean).join(" ").trim();
  if (fullName) return fullName;
  return patient.user?.email || `Patient #${patient?.patientId || ""}`;
}

function doctorDisplay(user = {}) {
  const profile = user.doctorProfile || {};
  const fullName = [profile.firstName, profile.lastName].filter(Boolean).join(" ").trim();
  if (fullName) return fullName;
  return user.email || "Doctor";
}

function statusLabel(value = "") {
  const normalized = String(value || "").toUpperCase();
  if (normalized === "SUBMITTED") return "AI Support Active";
  if (normalized === "IN_REVIEW") return "In Review";
  if (normalized === "CLOSED") return "Closed";
  return value || "Case";
}

function setAdminIdentity(profile = {}) {
  if (!meLabel) return;
  meLabel.innerHTML = `
    <span class="user-chip__primary">${escapeHtml(adminDisplayName(profile))}</span>
    <span class="user-chip__role">Admin</span>
  `;
}

function setQueueStatus(message) {
  if (queueStatus) queueStatus.textContent = message || "";
}

async function loadMe() {
  try {
    const response = await apiFetch("/users/me");
    setAdminIdentity(response?.data || {});
  } catch (_) {
    if (meLabel) meLabel.textContent = "Admin";
  }
}

async function loadCases() {
  setQueueStatus("Loading queue...");
  const res = await apiFetch("/admin/cases?unassigned=true");
  const cases = res?.data?.items || [];

  caseList.innerHTML = "";
  if (!cases.length) {
    empty.style.display = "block";
    setQueueStatus("Queue clear");
    return;
  }

  empty.style.display = "none";
  setQueueStatus(`${cases.length} unassigned case${cases.length === 1 ? "" : "s"}`);

  caseList.innerHTML = cases
    .map((caseData) => {
      const title = caseData.intake?.title || `Case #${caseData.id}`;
      const patient = patientDisplay(caseData);
      const submitted = fmtDate(caseData.submittedAt);
      const urgent = caseData.isEmergency ? `<span class="badge emergency">Urgent</span>` : "";
      return `
        <article class="queue-item">
          <div>
            <h3 class="queue-item__title">${escapeHtml(title)}</h3>
            <div class="queue-item__meta">
              <span>${escapeHtml(patient)}</span>
              <span>${escapeHtml(submitted)}</span>
              <span>${escapeHtml(statusLabel(caseData.status || "SUBMITTED"))}</span>
            </div>
          </div>
          <div class="queue-item__right">
            ${urgent}
            <button class="btn primary" data-assign-case="${caseData.id}">Assign doctor</button>
          </div>
        </article>
      `;
    })
    .join("");
}

async function loadDoctors() {
  const res = await apiFetch("/users?role=DOCTOR");
  const users = res?.data || [];
  doctors = users.filter((user) => user.doctorProfile && user.doctorProfile.doctorId);
  if (!doctors.length) {
    doctorSelect.innerHTML = `<option value="">No doctors available</option>`;
    return;
  }

  doctorSelect.innerHTML = doctors
    .map(
      (doctor) => `
        <option value="${doctor.doctorProfile.doctorId}">
          ${escapeHtml(doctorDisplay(doctor))} - ${escapeHtml(doctor.doctorProfile.specialty || "General review")}
        </option>
      `
    )
    .join("");
}

function openModal(caseId) {
  selectedCaseId = Number(caseId);
  if (modalBackdrop) modalBackdrop.style.display = "flex";
}

function closeModal() {
  if (modalBackdrop) modalBackdrop.style.display = "none";
  selectedCaseId = null;
}

async function assignDoctor() {
  const doctorId = Number(doctorSelect.value);
  if (!Number.isInteger(doctorId)) {
    toast?.error?.("Invalid doctor selected");
    return;
  }

  try {
    assignBtn.disabled = true;
    assignBtn.textContent = "Assigning doctor...";
    await apiFetch(`/cases/${selectedCaseId}/assign-doctor`, {
      method: "PUT",
      body: JSON.stringify({ doctorId }),
    });

    toast?.success?.("Doctor review assigned.");
    closeModal();
    await loadCases();
  } catch (error) {
    toast?.error?.(error?.message || "Unable to assign doctor");
  } finally {
    assignBtn.disabled = false;
    assignBtn.textContent = "Assign doctor";
  }
}

document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-assign-case]");
  if (!button) return;
  openModal(button.getAttribute("data-assign-case"));
});

closeBtn?.addEventListener("click", closeModal);
modalBackdrop?.addEventListener("click", (event) => {
  if (event.target === modalBackdrop) closeModal();
});
assignBtn?.addEventListener("click", assignDoctor);
refreshBtn?.addEventListener("click", loadCases);
logoutBtn?.addEventListener("click", () => {
  clearSession();
  window.location.href = "/admin/index.html";
});

(async function init() {
  try {
    await loadMe();
    await loadDoctors();
    await loadCases();
  } catch (error) {
    setQueueStatus("Unable to load queue");
    toast?.error?.("Failed to load admin queue");
  }
})();
