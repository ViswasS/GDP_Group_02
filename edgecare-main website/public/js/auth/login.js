const out = document.getElementById("out");
const loginBtn = document.getElementById("loginBtn");
const emailEl = document.getElementById("email");
const passwordEl = document.getElementById("password");
const roleEl = document.getElementById("role");
const formError = document.getElementById("formError");
const API_ROOT = window.EDGECARE_API_ROOT || "/api/v1";

function showDebug(obj) {
  if (!out) return;
  out.style.display = "block";
  out.textContent = typeof obj === "string" ? obj : JSON.stringify(obj, null, 2);
}

function showError(message) {
  if (!formError) return;
  formError.textContent = message || "Something went wrong.";
  formError.style.display = "block";
}

function clearError() {
  if (!formError) return;
  formError.style.display = "none";
  formError.textContent = "";
}

function setDefaultRole() {
  const qpRole = new URLSearchParams(window.location.search).get("role");
  const role = (qpRole || document.body.dataset.defaultRole || "").toUpperCase();
  if (role && roleEl) roleEl.value = role;
}

function isValidEmail(email = "") {
  return /\S+@\S+\.\S+/.test(email);
}

async function handleLogin() {
  if (!loginBtn || loginBtn.disabled) return;

  clearError();
  const defaultText = loginBtn.textContent;
  loginBtn.textContent = "Logging in...";
  loginBtn.disabled = true;

  const email = emailEl.value.trim();
  const password = passwordEl.value;
  const role = (roleEl.value || "").toUpperCase();

  if (!isValidEmail(email)) {
    showError("Enter a valid email address.");
    loginBtn.textContent = defaultText;
    loginBtn.disabled = false;
    return;
  }
  if (!password) {
    showError("Password is required.");
    loginBtn.textContent = defaultText;
    loginBtn.disabled = false;
    return;
  }
  if (!role) {
    showError("Select a role (Doctor or Patient).");
    loginBtn.textContent = defaultText;
    loginBtn.disabled = false;
    return;
  }

  try {
    toast?.info?.("Logging in...");
    const res = await fetch(`${API_ROOT}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, role }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw data;

    const payload = data?.data;
    if (payload?.user?.role) saveSession(payload);

    //showDebug(data);
    toast?.success?.("Welcome back. Redirecting...");
    const dest = redirectByRole(payload?.user?.role) || "/doctor-dashboard.html";
    window.location.href = dest;
  } catch (e) {
    const msg = e?.message || e?.error || "Login failed. Check your credentials.";
    //showDebug(e);
    showError(msg);
    toast?.error?.(msg);
    loginBtn.disabled = false;
    loginBtn.textContent = defaultText;
    return;
  }
}

// Auto-redirect if already logged in with a valid role
(function redirectIfSession() {
  const role = getRole();
  const token = getAccessToken();
  if (token && role) {
    window.location.href = redirectByRole(role);
  }
})();

setDefaultRole();
emailEl?.addEventListener("input", clearError);
passwordEl?.addEventListener("input", clearError);
roleEl?.addEventListener("change", clearError);
loginBtn?.addEventListener("click", handleLogin);
