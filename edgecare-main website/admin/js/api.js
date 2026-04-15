function stripTrailingSlash(value = "") {
  return String(value).replace(/\/$/, "");
}

function resolveApiBase() {
  if (window.EDGECARE_API_BASE) return stripTrailingSlash(window.EDGECARE_API_BASE);

  const origin = stripTrailingSlash(window.location.origin);
  if (origin === "http://localhost:3000") return "https://edgecare.onrender.com";
  if (origin === "https://edgecareai.tech") return "https://edgecare.onrender.com";
  return origin;
}

const EDGECARE_API_BASE = resolveApiBase();
const API_BASE = `${EDGECARE_API_BASE}/api/v1`;

window.EDGECARE_API_BASE = EDGECARE_API_BASE;
window.EDGECARE_API_ROOT = API_BASE;

function getAccessToken() {
  return localStorage.getItem("accessToken");
}
function getRole() {
  return localStorage.getItem("role");
}

function clearSession() {
  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
  localStorage.removeItem("role");
}

function requireAdminAuth() {
  const token = getAccessToken();
  const role = getRole();

  if (!token || role !== "ADMIN") {
    clearSession();
    window.location.href = "/admin/index.html";
    return false;
  }
  return true;
}

async function apiFetch(path, options = {}) {
  const token = getAccessToken();

  const res = await fetch(API_BASE + path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  const data = await res.json().catch(() => ({}));

  if (res.status === 401 || res.status === 403) {
    clearSession();
    window.location.href = "/admin/index.html";
    return;
  }

  if (!res.ok) {
    throw new Error(data?.message || "Request failed");
  }

  return data;
}
