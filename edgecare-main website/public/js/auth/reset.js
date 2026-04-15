const resetOut = document.getElementById("out");
const resetBtn = document.getElementById("resetBtn");
const passwordEl = document.getElementById("password");
const confirmPasswordEl = document.getElementById("confirmPassword");
const formError = document.getElementById("formError");
const tokenWarning = document.getElementById("tokenWarning");

const params = new URLSearchParams(window.location.search);
const token = params.get("token") || "";

function showDebug(obj) {
  if (!resetOut) return;
  resetOut.style.display = "block";
  resetOut.textContent = typeof obj === "string" ? obj : JSON.stringify(obj, null, 2);
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

function validatePasswords() {
  const pwd = passwordEl.value;
  const confirm = confirmPasswordEl.value;
  if (!pwd || pwd.length < 8) return { ok: false, message: "Password must be at least 8 characters." };
  if (pwd !== confirm) return { ok: false, message: "Passwords do not match." };
  return { ok: true, password: pwd };
}

if (!token) {
  tokenWarning.textContent = "Missing reset token in URL (?token=...).";
  tokenWarning.style.color = "var(--danger)";
} else {
  tokenWarning.textContent = "Token detected. Complete the form to reset your password.";
}

async function handleReset() {
  if (!resetBtn || resetBtn.disabled) return;
  clearError();

  if (!token) {
    showError("Reset token is required from the email link.");
    return;
  }

  const validation = validatePasswords();
  if (!validation.ok) {
    showError(validation.message);
    return;
  }

  const defaultText = resetBtn.textContent;
  resetBtn.textContent = "Resetting...";
  resetBtn.disabled = true;

  try {
    const res = await fetch("/api/v1/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password: validation.password }),
    });
    const data = await res.json().catch(() => ({}));

    if (res.status === 404) {
      showDebug({ warning: "Endpoint missing", status: res.status, payload: data });
      toast?.info?.("Password reset endpoint is not available on this build. Contact backend.");
      resetBtn.textContent = defaultText;
      resetBtn.disabled = false;
      return;
    }

    if (!res.ok) throw data;

    showDebug(data);
    toast?.success?.("Password updated. Redirecting to login...");
    setTimeout(() => (window.location.href = "/doctor-login.html"), 800);
  } catch (e) {
    const msg = e?.message || e?.error || "Reset failed.";
    showDebug(e);
    showError(msg);
    toast?.error?.(msg);
    resetBtn.disabled = false;
    resetBtn.textContent = defaultText;
    return;
  }

  resetBtn.textContent = defaultText;
  resetBtn.disabled = false;
}

passwordEl?.addEventListener("input", clearError);
confirmPasswordEl?.addEventListener("input", clearError);
resetBtn?.addEventListener("click", handleReset);
