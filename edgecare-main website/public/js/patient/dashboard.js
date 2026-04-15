requirePatientAuth();

const profileEl = document.getElementById("profile");
const meLabel = document.getElementById("meLabel");
const logoutBtn = document.getElementById("logoutBtn");
const out = document.getElementById("out");
const ML_HEALTH_FLAG = "edgecare_ml_health_checked";
const ML_HEALTH_URL = `${window.EDGECARE_ML_BASE || "https://edge-care.onrender.com"}/ml/health`;

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

function renderProfile(p) {
  if (!p) {
    profileEl.innerHTML = `<div class="empty-state"><strong>Profile not found</strong><span>We could not load your patient profile right now.</span></div>`;
    return;
  }

  const displayName = patientDisplayName(p);
  const email = p.user?.email || "-";
  const language = p.language || "en";
  const consent = p.consentStatus ? "Granted" : "Not granted";

  profileEl.innerHTML = `
    <div class="item">
      <div class="item-left">
        <div class="item-title">${escapeHtml(displayName)}</div>
        <div class="item-meta">
          <span>${escapeHtml(email)}</span>
          <span>Role: PATIENT</span>
          <span>Language: ${escapeHtml(language)}</span>
          <span>Consent: ${escapeHtml(consent)}</span>
        </div>
      </div>
    </div>
  `;
}

async function loadProfile() {
  try {
    const resp = await apiFetch("/patient/profile", { method: "GET" }, { loginPath: "/patient-login.html" });
    const p = resp?.data;
    setPatientIdentity(p);
    renderProfile(p);
  } catch (e) {
    showDebug({ message: e.message, status: e.status, payload: e.payload });
    profileEl.innerHTML = `<div class="empty-state empty-state--error"><strong>Unable to load profile</strong><span>${escapeHtml(e?.message || "Try refreshing the page.")}</span></div>`;
  }
}

function warmMlService() {
  try {
    if (sessionStorage.getItem(ML_HEALTH_FLAG)) return;
    sessionStorage.setItem(ML_HEALTH_FLAG, "1");
    fetch(ML_HEALTH_URL, { method: "GET" })
      .then((res) => {
        if (!res.ok) throw new Error(`ML health ${res.status}`);
      })
      .catch((err) => {
        console.warn("ML warmup failed", err);
      });
  } catch (e) {
    console.warn("ML warmup skipped", e);
  }
}

logoutBtn?.addEventListener("click", () => logout("/patient-login.html?role=PATIENT"));

loadProfile();
warmMlService();

