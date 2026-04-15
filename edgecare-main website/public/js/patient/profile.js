requirePatientAuth();

const meLabel = document.getElementById("meLabel");
const logoutBtn = document.getElementById("logoutBtn");
const profileStatus = document.getElementById("profileStatus");
const profileForm = document.getElementById("profileForm");
const out = document.getElementById("out");

const firstNameEl = document.getElementById("firstName");
const lastNameEl = document.getElementById("lastName");
const dobEl = document.getElementById("dob");
const genderEl = document.getElementById("gender");
const languageEl = document.getElementById("language");
const consentEl = document.getElementById("consentStatus");
const emailEl = document.getElementById("email");
const allergiesEl = document.getElementById("allergies");
const knownMedicalConditionsEl = document.getElementById("knownMedicalConditions");
const tabButtons = Array.from(document.querySelectorAll("[data-profile-tab]"));
const tabSections = Array.from(document.querySelectorAll("[data-profile-section]"));

const editBtn = document.getElementById("editBtn");
const saveBtn = document.getElementById("saveBtn");
const cancelBtn = document.getElementById("cancelBtn");

let original = null;
let editing = false;

function normalizeNullableText(value) {
  const normalized = String(value ?? "").trim();
  return normalized || null;
}

function setDebug(obj) {
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

function setEditing(on) {
  editing = on;
  const disabled = !on;
  [firstNameEl, lastNameEl, dobEl, genderEl, languageEl, consentEl, allergiesEl, knownMedicalConditionsEl].forEach((el) => {
    if (!el) return;
    if (el.type === "checkbox") {
      el.disabled = disabled;
    } else {
      el.toggleAttribute("disabled", disabled);
    }
  });
  if (saveBtn) saveBtn.style.display = on ? "inline-flex" : "none";
  if (cancelBtn) cancelBtn.style.display = on ? "inline-flex" : "none";
}

function populate(p) {
  if (!p) return;
  firstNameEl.value = p.firstName || "";
  lastNameEl.value = p.lastName || "";
  dobEl.value = p.dob ? String(p.dob).slice(0, 10) : "";
  genderEl.value = p.gender || "";
  languageEl.value = p.language || "";
  consentEl.checked = Boolean(p.consentStatus);
  allergiesEl.value = p.allergies || "";
  knownMedicalConditionsEl.value = p.knownMedicalConditions || "";
  emailEl.value = p.user?.email || "";
}

function setActiveTab(sectionName) {
  tabButtons.forEach((button) => {
    const active = button.dataset.profileTab === sectionName;
    button.classList.toggle("profile-tab--active", active);
    button.setAttribute("aria-selected", active ? "true" : "false");
  });

  tabSections.forEach((section) => {
    const active = section.dataset.profileSection === sectionName;
    section.classList.toggle("profile-section--active", active);
  });
}

async function loadProfile() {
  try {
    profileStatus.textContent = "Loading profile...";
    const res = await apiFetch("/patient/profile", { method: "GET" }, { loginPath: "/patient-login.html" });
    const p = res?.data;
    if (!p) throw new Error("Profile not found");
    setPatientIdentity(p);
    original = p;
    populate(p);
    profileStatus.style.display = "none";
    profileForm.style.display = "flex";
    setEditing(false);
  } catch (e) {
    profileStatus.textContent = e?.message || "Unable to load profile";
    setDebug(e?.payload || e);
  }
}

function collectPayload() {
  const body = {};
  if (firstNameEl.value) body.firstName = firstNameEl.value.trim();
  if (lastNameEl.value) body.lastName = lastNameEl.value.trim();
  if (dobEl.value) body.dob = dobEl.value;
  if (genderEl.value) body.gender = genderEl.value;
  if (languageEl.value) body.language = languageEl.value.trim();
  body.consentStatus = consentEl.checked;
  body.allergies = allergiesEl.value.trim() || null;
  body.knownMedicalConditions = knownMedicalConditionsEl.value.trim() || null;
  return body;
}

async function saveProfile() {
  try {
    saveBtn.disabled = true;
    profileStatus.style.display = "block";
    profileStatus.textContent = "Saving profile...";
    const payload = collectPayload();
    await apiFetch("/patient/profile", {
      method: "PATCH",
      body: JSON.stringify(payload),
    }, { loginPath: "/patient-login.html" });

    const verify = await apiFetch("/patient/profile", { method: "GET" }, { loginPath: "/patient-login.html" });
    const persisted = verify?.data;
    if (!persisted) throw new Error("Profile reload failed after save");

    const allergiesSaved = normalizeNullableText(persisted.allergies) === normalizeNullableText(payload.allergies);
    const conditionsSaved =
      normalizeNullableText(persisted.knownMedicalConditions) === normalizeNullableText(payload.knownMedicalConditions);

    if (!allergiesSaved || !conditionsSaved) {
      throw new Error("Profile save response succeeded, but medical info was not persisted. Refresh the server and try again.");
    }

    original = persisted;
    populate(persisted);
    profileStatus.style.display = "none";
    setEditing(false);
    toast.success("Profile updated");
  } catch (e) {
    profileStatus.style.display = "block";
    profileStatus.textContent = e?.message || "Failed to update profile";
    toast.error(e?.message || "Failed to update profile");
    setDebug(e?.payload || e);
  } finally {
    saveBtn.disabled = false;
  }
}

function resetForm() {
  if (original) populate(original);
  setEditing(false);
}

editBtn?.addEventListener("click", () => setEditing(true));
cancelBtn?.addEventListener("click", resetForm);
saveBtn?.addEventListener("click", saveProfile);
tabButtons.forEach((button) => {
  button.addEventListener("click", () => setActiveTab(button.dataset.profileTab || "overview"));
});

logoutBtn?.addEventListener("click", () => logout("/patient-login.html?role=PATIENT"));

loadProfile();

