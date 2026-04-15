const forgotOut = document.getElementById("out");
const forgotBtn = document.getElementById("forgotBtn");
const emailEl = document.getElementById("email");
const formError = document.getElementById("formError");

function showDebug(obj) {
  if (!forgotOut) return;
  forgotOut.style.display = "block";
  forgotOut.textContent = typeof obj === "string" ? obj : JSON.stringify(obj, null, 2);
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

function isValidEmail(email = "") {
  return /\S+@\S+\.\S+/.test(email);
}

async function handleForgot() {
  if (!forgotBtn || forgotBtn.disabled) return;
  clearError();

  const email = emailEl.value.trim();
  if (!isValidEmail(email)) {
    showError("Enter a valid email address.");
    return;
  }

  const defaultText = forgotBtn.textContent;
  forgotBtn.textContent = "Sending...";
  forgotBtn.disabled = true;

  try {
    const res = await fetch("/api/v1/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    const data = await res.json().catch(() => ({}));

    if (res.status === 404) {
      // Backend endpoint not available; surface for audit but keep UX neutral
      showDebug({ warning: "Endpoint missing", status: res.status, payload: data });
      toast?.info?.("If the email exists, a reset link has been sent.");
      forgotBtn.textContent = defaultText;
      forgotBtn.disabled = false;
      return;
    }

    if (!res.ok) throw data;

    showDebug(data);
    toast?.success?.("If the email exists, a reset link has been sent.");
  } catch (e) {
    const msg = e?.message || e?.error || "Unable to process request.";
    showDebug(e);
    showError(msg);
    toast?.error?.(msg);
    forgotBtn.disabled = false;
    forgotBtn.textContent = defaultText;
    return;
  }

  forgotBtn.textContent = defaultText;
  forgotBtn.disabled = false;
}

emailEl?.addEventListener("input", clearError);
forgotBtn?.addEventListener("click", handleForgot);
