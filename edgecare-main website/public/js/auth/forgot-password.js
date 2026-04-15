import { forgotPassword } from "../api.js";

const form = document.getElementById("forgotForm");
const emailInput = document.getElementById("email");
const statusBox = document.getElementById("statusBox");
const submitBtn = document.getElementById("submitBtn");

function setStatus(type, message) {
  statusBox.classList.remove("hidden", "success", "error");
  statusBox.classList.add(type === "error" ? "error" : "success", "banner");
  statusBox.textContent = message;
}

function setLoading(isLoading) {
  submitBtn.disabled = isLoading;
  submitBtn.textContent = isLoading ? "Sending…" : "Send reset link";
}

form?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = (emailInput.value || "").trim();
  if (!email) {
    setStatus("error", "Please enter your email.");
    return;
  }

  setLoading(true);
  try {
    await forgotPassword(email);
  } catch (err) {
    console.error("Forgot password failed (ignored):", err.message);
  } finally {
    setLoading(false);
    setStatus("success", "If an account exists for that email, a reset link has been sent.");
  }
});
