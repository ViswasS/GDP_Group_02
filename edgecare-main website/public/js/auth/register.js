const regOut = document.getElementById("out");
const registerBtn = document.getElementById("registerBtn");
const goLoginBtn = document.getElementById("goLoginBtn");
const formError = document.getElementById("formError");

const emailEl = document.getElementById("email");
const passwordEl = document.getElementById("password");
const confirmPasswordEl = document.getElementById("confirmPassword");
const roleEl = document.getElementById("role");
const firstNameEl = document.getElementById("firstName");
const lastNameEl = document.getElementById("lastName");

// Doctor fields
const licenseEl = document.getElementById("licenseNumber");
const specialtyEl = document.getElementById("specialty");
const experienceEl = document.getElementById("experience");
const doctorFields = document.getElementById("doctorFields");
const API_ROOT = window.EDGECARE_API_ROOT || "/api/v1";

// Patient fields
const patientFields = document.getElementById("patientFields");
const languageEl = document.getElementById("language");
const consentEl = document.getElementById("consent");

function showRegDebug(obj) {
  if (!regOut) return;
  regOut.style.display = "block";
  regOut.textContent = typeof obj === "string" ? obj : JSON.stringify(obj, null, 2);
}

function showRegError(message) {
  if (!formError) return;
  formError.textContent = message || "Something went wrong.";
  formError.style.display = "block";
}

function clearRegError() {
  if (!formError) return;
  formError.style.display = "none";
  formError.textContent = "";
}

function isValidEmail(email = "") {
  return /\S+@\S+\.\S+/.test(email);
}

function toggleRoleFields(role) {
  const r = (role || "").toUpperCase();
  if (doctorFields) doctorFields.style.display = r === "DOCTOR" ? "block" : "none";
  if (patientFields) patientFields.style.display = r === "PATIENT" ? "block" : "none";
}

function defaultRole() {
  const qpRole = new URLSearchParams(window.location.search).get("role");
  return (qpRole || document.body.dataset.defaultRole || "").toUpperCase();
}

function validate() {
  const email = emailEl.value.trim();
  const password = passwordEl.value;
  const confirm = confirmPasswordEl.value;
  const role = (roleEl.value || "").toUpperCase();
  const firstName = firstNameEl?.value.trim();
  const lastName = lastNameEl?.value.trim();

  if (!isValidEmail(email)) return { ok: false, message: "Enter a valid email address." };
  if (!password || password.length < 8) return { ok: false, message: "Password must be at least 8 characters." };
  if (password !== confirm) return { ok: false, message: "Passwords do not match." };
  if (!role) return { ok: false, message: "Select a role (Doctor or Patient)." };
  if (!firstName) return { ok: false, message: "First name is required." };
  if (!lastName) return { ok: false, message: "Last name is required." };

  if (role === "DOCTOR") {
    if (!licenseEl.value.trim() || !specialtyEl.value.trim()) {
      return { ok: false, message: "License number and specialty are required for doctors." };
    }
    const exp = experienceEl.value.trim();
    if (exp && (Number.isNaN(Number(exp)) || Number(exp) < 0)) {
      return { ok: false, message: "Experience must be a non-negative number." };
    }
  }

  return { ok: true, role };
}

function updateButtonState() {
  const { ok } = validate();
  if (registerBtn) registerBtn.disabled = !ok;
}

async function handleRegister() {
  if (!registerBtn || registerBtn.disabled) return;

  clearRegError();
  const validation = validate();
  if (!validation.ok) {
    showRegError(validation.message);
    updateButtonState();
    return;
  }

  const defaultText = registerBtn.textContent;
  registerBtn.textContent = "Registering...";
  registerBtn.disabled = true;

  const role = (roleEl.value || "").toUpperCase();
  const email = emailEl.value.trim();
  const password = passwordEl.value;
  const firstName = firstNameEl?.value.trim();
  const lastName = lastNameEl?.value.trim();

  const profile = {};
  if (firstName) profile.firstName = firstName;
  if (lastName) profile.lastName = lastName;
  if (role === "DOCTOR") {
    profile.licenseNumber = licenseEl.value.trim();
    profile.specialty = specialtyEl.value.trim();
    profile.experience = Number(experienceEl.value || 0);
  } else if (role === "PATIENT") {
    profile.language = (languageEl?.value || "en").trim();
    profile.consentStatus = Boolean(consentEl?.checked);
  }

  try {
    toast?.info?.("Creating account...");
    const res = await fetch(`${API_ROOT}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, role, profile }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw data;

    //showRegDebug(data);
    toast?.success?.("Account created. Redirecting to login...");
    const dest = role === "PATIENT" ? "/patient-login.html" : "/doctor-login.html";
    setTimeout(() => (window.location.href = `${dest}?role=${role}`), 600);
  } catch (e) {
    const msg = e?.message || e?.error || "Registration failed.";
    showRegDebug(e);
    showRegError(msg);
    toast?.error?.(msg);
    registerBtn.disabled = false;
    registerBtn.textContent = defaultText;
    return;
  }
}

function initRole() {
  const r = defaultRole();
  if (r) roleEl.value = r;
  toggleRoleFields(r || roleEl.value);
}

// Wire up events
initRole();
updateButtonState();

[emailEl, passwordEl, confirmPasswordEl, roleEl, firstNameEl, lastNameEl, licenseEl, specialtyEl, experienceEl, languageEl, consentEl]
  .filter(Boolean)
  .forEach((el) => {
    el.addEventListener(el.type === "checkbox" ? "change" : "input", () => {
      clearRegError();
      toggleRoleFields(roleEl.value);
      updateButtonState();
    });
  });

registerBtn?.addEventListener("click", handleRegister);
goLoginBtn?.addEventListener("click", () => {
  const role = (roleEl.value || "").toUpperCase() || "DOCTOR";
  const dest = role === "PATIENT" ? "/patient-login.html" : "/doctor-login.html";
  window.location.href = `${dest}?role=${role}`;
});
