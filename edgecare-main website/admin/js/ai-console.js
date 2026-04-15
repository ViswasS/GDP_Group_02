requireAdminAuth();

const logoutBtn = document.getElementById("logoutBtn");
const frame = document.getElementById("aiFrame");
const fallback = document.getElementById("iframeFallback");
const meLabel = document.getElementById("meLabel");

function adminDisplayName(profile = {}) {
  const admin = profile?.adminProfile || {};
  const fullName = [admin.firstName, admin.lastName].filter(Boolean).join(" ").trim();
  if (fullName) return fullName;
  const email = profile?.email || "";
  return email ? email.split("@")[0] : "Admin";
}

async function loadMe() {
  try {
    const response = await apiFetch("/users/me");
    if (!meLabel) return;
    meLabel.innerHTML = `
      <span class="user-chip__primary">${adminDisplayName(response?.data || {})}</span>
      <span class="user-chip__role">Admin</span>
    `;
  } catch (_) {
    if (meLabel) meLabel.textContent = "Admin";
  }
}

logoutBtn?.addEventListener("click", () => {
  clearSession();
  window.location.href = "/admin/index.html";
});

frame?.addEventListener("error", () => {
  if (fallback) fallback.style.display = "block";
});

frame?.addEventListener("load", () => {
  if (fallback) fallback.style.display = "none";
});

loadMe();
