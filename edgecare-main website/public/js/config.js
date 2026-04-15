function stripTrailingSlash(value = "") {
  return String(value).replace(/\/$/, "");
}

function resolveApiBase() {
  const injected = window.EDGECARE_API_BASE || window.__EDGECARE_CONFIG__?.apiBaseUrl;
  if (injected) return stripTrailingSlash(injected);

  const origin = stripTrailingSlash(window.location.origin);
  if (origin === "http://localhost:3000") return "https://edgecare.onrender.com";
  if (origin === "https://edgecareai.tech") return "https://edgecare.onrender.com";
  return origin;
}

function resolveMlBase() {
  const injected = window.EDGECARE_ML_BASE || window.__EDGECARE_CONFIG__?.mlBaseUrl;
  if (injected) return stripTrailingSlash(injected);
  return "https://edge-care.onrender.com";
}

// Global config for public pages that use ES modules (e.g., reset password flows)
const EDGECARE_API_BASE = resolveApiBase();
const EDGECARE_ML_BASE = resolveMlBase();

// Keep existing name for compatibility with current module consumers
const API_BASE_URL = EDGECARE_API_BASE;

// Cloudinary unsigned upload (frontend). Override via window.CLOUDINARY_* if injected inline.
const CLOUDINARY_CLOUD_NAME = "dyhnozulq";
const CLOUDINARY_UPLOAD_PRESET = "edgecare_unsigned";

export {
  API_BASE_URL,
  EDGECARE_API_BASE,
  EDGECARE_ML_BASE,
  CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_UPLOAD_PRESET,
};
