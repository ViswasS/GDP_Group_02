import { verifyResetToken, resetPassword } from "../api.js";

const params = new URLSearchParams(window.location.search);
const token = params.get("token") || "";

const statusBox = document.getElementById("statusBox");
const actions = document.getElementById("actions");
const goLoginBtn = document.getElementById("goLoginBtn");
const resetForm = document.getElementById("resetForm");
const newPasswordInput = document.getElementById("newPassword");
const confirmPasswordInput = document.getElementById("confirmPassword");
const submitBtn = document.getElementById("submitBtn");

function setStatus(type, message) {
  statusBox.classList.remove("hidden", "success", "error");
  statusBox.classList.add(type === "error" ? "error" : "success", "banner");
  statusBox.textContent = message;
}

function togglePassword(btn) {
  const targetId = btn.getAttribute("data-target");
  const input = document.getElementById(targetId);
  if (!input) return;
  const show = input.type === "password";
  input.type = show ? "text" : "password";
  btn.textContent = show ? "Hide" : "Show";
}

document.querySelectorAll(".toggle").forEach((btn) => {
  btn.addEventListener("click", () => togglePassword(btn));
});

async function bootstrap() {
  if (!token) {
    setStatus("error", "Missing reset token. Request a new link.");
    actions.classList.remove("hidden");
    return;
  }

  try {
    const res = await verifyResetToken(token);
    const valid = res?.data?.valid;
    if (valid) {
      resetForm.classList.remove("hidden");
      setStatus("success", "Token verified. Set your new password.");
    } else {
      setStatus("error", "This reset link is invalid or expired. Request a new one.");
      actions.classList.remove("hidden");
    }
  } catch (err) {
    console.error("Verify token failed:", err.message);
    setStatus("error", "Unable to verify token right now. Please request a new link.");
    actions.classList.remove("hidden");
  }
}

function validatePasswords() {
  const pwd = newPasswordInput.value || "";
  const confirm = confirmPasswordInput.value || "";
  if (pwd.length < 8) return "Password must be at least 8 characters.";
  if (pwd !== confirm) return "Passwords must match.";
  return null;
}

resetForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const error = validatePasswords();
  if (error) {
    setStatus("error", error);
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = "Resetting…";
  try {
    await resetPassword(token, newPasswordInput.value, confirmPasswordInput.value);
    setStatus("success", "Password reset successful. You can log in now.");
    goLoginBtn.classList.remove("hidden");
    actions.classList.remove("hidden");
    resetForm.classList.add("hidden");
  } catch (err) {
    const message = err?.data?.message || err.message || "Reset failed.";
    setStatus("error", message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Reset password";
  }
});

bootstrap();
