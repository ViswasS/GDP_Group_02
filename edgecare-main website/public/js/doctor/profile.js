requireDoctorAuth();

const meLabel = document.getElementById("meLabel");
const logoutBtn = document.getElementById("logoutBtn");
const profileStatus = document.getElementById("profileStatus");
const profileForm = document.getElementById("profileForm");
const out = document.getElementById("out");

const firstNameEl = document.getElementById("firstName");
const lastNameEl = document.getElementById("lastName");
const dobEl = document.getElementById("dob");
const genderEl = document.getElementById("gender");
const specialtyEl = document.getElementById("specialty");
const licenseEl = document.getElementById("licenseNumber");
const experienceEl = document.getElementById("experience");
const emailEl = document.getElementById("email");

const editBtn = document.getElementById("editBtn");
const saveBtn = document.getElementById("saveBtn");
const cancelBtn = document.getElementById("cancelBtn");

let original = null;

function setDebug(obj) {
  if (!out) return;
  out.style.display = "block";
  out.textContent = typeof obj === "string" ? obj : JSON.stringify(obj, null, 2);
}

function doctorDisplayName(profile = {}) {
  const fullName = [profile.firstName, profile.lastName].filter(Boolean).join(" ").trim();
  if (fullName) return fullName;
  const email = profile.user?.email || "";
  return email ? email.split("@")[0] : "Doctor";
}

function setEditing(on) {
  const disabled = !on;
  [firstNameEl, lastNameEl, dobEl, genderEl, specialtyEl, licenseEl, experienceEl].forEach((el) => {
    if (!el) return;
    el.toggleAttribute("disabled", disabled);
  });
  if (saveBtn) saveBtn.style.display = on ? "inline-flex" : "none";
  if (cancelBtn) cancelBtn.style.display = on ? "inline-flex" : "none";
}

function populate(profile) {
  if (!profile) return;
  firstNameEl.value = profile.firstName || "";
  lastNameEl.value = profile.lastName || "";
  dobEl.value = profile.dob ? String(profile.dob).slice(0, 10) : "";
  genderEl.value = profile.gender || "";
  specialtyEl.value = profile.specialty || "";
  licenseEl.value = profile.licenseNumber || "";
  experienceEl.value = Number.isFinite(profile.experience) ? profile.experience : "";
  emailEl.value = profile.user?.email || "";
}

async function loadProfile() {
  try {
    profileStatus.textContent = "Loading profile...";
    const res = await apiFetch("/doctor/profile", { method: "GET" }, { loginPath: "/doctor-login.html" });
    const profile = res?.data;
    if (!profile) throw new Error("Profile not found");

    meLabel.innerHTML = `
      <span class="user-chip__primary">${escapeHtml(doctorDisplayName(profile))}</span>
      <span class="user-chip__role">Doctor</span>
    `;

    original = profile;
    populate(profile);
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
  if (specialtyEl.value) body.specialty = specialtyEl.value.trim();
  if (licenseEl.value) body.licenseNumber = licenseEl.value.trim();
  if (experienceEl.value !== "") body.experience = Number(experienceEl.value);
  return body;
}

async function saveProfile() {
  try {
    saveBtn.disabled = true;
    const payload = collectPayload();
    const res = await apiFetch("/doctor/profile", {
      method: "PATCH",
      body: JSON.stringify(payload),
    }, { loginPath: "/doctor-login.html" });
    if (res?.data) {
      original = res.data;
      populate(res.data);
      meLabel.innerHTML = `
        <span class="user-chip__primary">${escapeHtml(doctorDisplayName(res.data))}</span>
        <span class="user-chip__role">Doctor</span>
      `;
      toast.success("Profile updated");
    }
    setEditing(false);
  } catch (e) {
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

logoutBtn?.addEventListener("click", () => logout("/doctor-login.html?role=DOCTOR"));

loadProfile();
