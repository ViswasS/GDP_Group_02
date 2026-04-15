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

function resolveMlBase() {
  if (window.EDGECARE_ML_BASE) return stripTrailingSlash(window.EDGECARE_ML_BASE);
  return "https://edge-care.onrender.com";
}

// Network bases (absolute per EdgeCare requirement)
const EDGECARE_API_BASE = resolveApiBase();
const EDGECARE_ML_BASE = resolveMlBase();
const API_BASE = `${EDGECARE_API_BASE}/api/v1`;
const ACCESS_KEY = "accessToken";
const REFRESH_KEY = "refreshToken";
const ROLE_KEY = "role";
const EMAIL_KEY = "userEmail";
const SESSION_ACTIVITY_KEY = "edgecare.session.activity";
const SESSION_LOGOUT_KEY = "edgecare.session.logout";
const WARNING_AFTER_MS = 4 * 60 * 1000;
const LOGOUT_AFTER_MS = 5 * 60 * 1000;
const WARNING_COUNTDOWN_MS = LOGOUT_AFTER_MS - WARNING_AFTER_MS;
const ACTIVITY_SYNC_THROTTLE_MS = 1000;

// expose for other scripts that rely on globals
window.EDGECARE_API_BASE = EDGECARE_API_BASE;
window.EDGECARE_ML_BASE = EDGECARE_ML_BASE;
window.EDGECARE_API_ROOT = API_BASE;
window.EDGECARE_SOCKET_BASE = EDGECARE_API_BASE;

function loginPathForRole(role = "") {
  return String(role || "").toUpperCase() === "PATIENT" ? "/patient-login.html" : "/doctor-login.html";
}

function sessionScopeFor(role = getRole(), email = getUserEmail()) {
  const normalizedRole = String(role || "").toUpperCase();
  const normalizedEmail = String(email || "").trim().toLowerCase();
  return [normalizedRole || "UNKNOWN", normalizedEmail || "anonymous"].join(":");
}

function safeStorageSet(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (error) {
    console.warn("Storage write failed", error);
  }
}

function readSignalScope(rawValue) {
  if (!rawValue) return null;
  try {
    return JSON.parse(rawValue)?.scope || null;
  } catch (_) {
    return null;
  }
}

const EdgeCareSessionGuard = (() => {
  const activityEvents = ["mousemove", "mousedown", "keydown", "scroll", "touchstart", "click"];
  const state = {
    initialized: false,
    role: null,
    loginPath: null,
    scope: null,
    warningTimeoutId: null,
    logoutTimeoutId: null,
    countdownIntervalId: null,
    warningVisible: false,
    warningDeadline: 0,
    remainingSeconds: Math.ceil(WARNING_COUNTDOWN_MS / 1000),
    modalRoot: null,
    countdownValueEl: null,
    stayButtonEl: null,
    logoutButtonEl: null,
    previousFocusEl: null,
    lastActivitySyncAt: 0,
    teardownFns: [],
  };

  function activeScope() {
    return state.scope || sessionScopeFor(state.role, getUserEmail());
  }

  function clearTimer(handleName) {
    const handle = state[handleName];
    if (handleName === "countdownIntervalId") clearInterval(handle);
    else clearTimeout(handle);
    state[handleName] = null;
  }

  function clearAllTimers() {
    clearTimer("warningTimeoutId");
    clearTimer("logoutTimeoutId");
    clearTimer("countdownIntervalId");
  }

  function ensureModal() {
    if (state.modalRoot || !document.body) return state.modalRoot;

    const root = document.createElement("div");
    root.className = "session-warning-modal";
    root.hidden = true;
    root.setAttribute("aria-hidden", "true");
    root.innerHTML = `
      <div class="session-warning-modal__backdrop" data-session-stay></div>
      <div
        class="session-warning-modal__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sessionWarningTitle"
        aria-describedby="sessionWarningDescription"
      >
        <div class="session-warning-modal__eyebrow">Session Timeout Warning</div>
        <h2 id="sessionWarningTitle" class="session-warning-modal__title">Stay logged in?</h2>
        <p id="sessionWarningDescription" class="session-warning-modal__copy">
          You’ve been inactive for a while. Your session will end automatically in
          <strong><span data-session-countdown>60</span> seconds</strong>
          unless you respond.
        </p>
        <div class="session-warning-modal__countdown" aria-live="polite">
          Closing in <span data-session-countdown-label>60</span>s
        </div>
        <div class="session-warning-modal__actions">
          <button type="button" class="btn primary" data-session-stay>Stay Logged In</button>
          <button type="button" class="btn" data-session-logout>Logout Now</button>
        </div>
      </div>
    `;

    document.body.appendChild(root);
    state.modalRoot = root;
    state.countdownValueEl = root.querySelector("[data-session-countdown]");
    state.countdownLabelEl = root.querySelector("[data-session-countdown-label]");
    state.stayButtonEl = root.querySelector("[data-session-stay].btn");
    state.logoutButtonEl = root.querySelector("[data-session-logout]");

    root.querySelectorAll("[data-session-stay]").forEach((node) => {
      node.addEventListener("click", stayLoggedIn);
    });
    state.logoutButtonEl?.addEventListener("click", logoutNow);

    return root;
  }

  function updateCountdown() {
    const seconds = Math.max(0, Math.ceil((state.warningDeadline - Date.now()) / 1000));
    state.remainingSeconds = seconds;
    if (state.countdownValueEl) state.countdownValueEl.textContent = String(seconds);
    if (state.countdownLabelEl) state.countdownLabelEl.textContent = String(seconds);
  }

  function closeWarning({ restoreFocus = true } = {}) {
    clearTimer("countdownIntervalId");
    if (!state.warningVisible) return;
    state.warningVisible = false;
    if (state.modalRoot) {
      state.modalRoot.hidden = true;
      state.modalRoot.setAttribute("aria-hidden", "true");
    }
    if (restoreFocus && state.previousFocusEl instanceof HTMLElement && document.contains(state.previousFocusEl)) {
      state.previousFocusEl.focus();
    }
    state.previousFocusEl = null;
  }

  function logoutNow() {
    logout(state.loginPath, { reason: "inactive_timeout" });
  }

  function openWarning() {
    ensureModal();
    if (!state.modalRoot || state.warningVisible) return;

    state.warningVisible = true;
    state.previousFocusEl = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    state.warningDeadline = Date.now() + WARNING_COUNTDOWN_MS;
    updateCountdown();

    state.modalRoot.hidden = false;
    state.modalRoot.setAttribute("aria-hidden", "false");
    state.stayButtonEl?.focus();

    clearTimer("countdownIntervalId");
    state.countdownIntervalId = window.setInterval(updateCountdown, 1000);
    clearTimer("logoutTimeoutId");
    state.logoutTimeoutId = window.setTimeout(logoutNow, WARNING_COUNTDOWN_MS);
  }

  function scheduleTimers() {
    clearAllTimers();
    state.warningDeadline = 0;
    state.remainingSeconds = Math.ceil(WARNING_COUNTDOWN_MS / 1000);
    state.warningTimeoutId = window.setTimeout(openWarning, WARNING_AFTER_MS);
  }

  function broadcastActivity() {
    const now = Date.now();
    if (now - state.lastActivitySyncAt < ACTIVITY_SYNC_THROTTLE_MS) return;
    state.lastActivitySyncAt = now;
    safeStorageSet(
      SESSION_ACTIVITY_KEY,
      JSON.stringify({
        at: now,
        scope: activeScope(),
      })
    );
  }

  function reset({ sync = true, restoreFocus = true } = {}) {
    closeWarning({ restoreFocus });
    scheduleTimers();
    if (sync) broadcastActivity();
  }

  function stayLoggedIn() {
    reset({ sync: true, restoreFocus: true });
  }

  function handleActivity(event) {
    if (!state.initialized) return;
    const target = event?.target;
    if (
      target instanceof Element &&
      target.closest?.("[data-session-logout]")
    ) {
      return;
    }
    reset({ sync: true });
  }

  function handleStorage(event) {
    if (!event) return;

    if (event.key === SESSION_ACTIVITY_KEY) {
      if (readSignalScope(event.newValue) !== activeScope()) return;
      reset({ sync: false });
      return;
    }

    if (event.key === SESSION_LOGOUT_KEY) {
      let payload = null;
      try {
        payload = event.newValue ? JSON.parse(event.newValue) : null;
      } catch (_) {
        payload = null;
      }
      if (!payload || payload.scope !== activeScope()) return;

      const redirectTo = payload.redirectTo || state.loginPath || loginPathForRole(payload.role || state.role);
      teardown();
      clearSession();
      if (redirectTo) window.location.href = redirectTo;
    }
  }

  function teardown() {
    clearAllTimers();
    closeWarning({ restoreFocus: false });
    state.teardownFns.forEach((fn) => {
      try {
        fn();
      } catch (_) {}
    });
    state.teardownFns = [];
    state.initialized = false;
  }

  function bindListeners() {
    activityEvents.forEach((eventName) => {
      const target = eventName === "scroll" ? window : document;
      const options = eventName === "scroll" || eventName === "touchstart" || eventName === "mousemove"
        ? { passive: true }
        : undefined;
      target.addEventListener(eventName, handleActivity, options);
      state.teardownFns.push(() => target.removeEventListener(eventName, handleActivity, options));
    });

    window.addEventListener("storage", handleStorage);
    state.teardownFns.push(() => window.removeEventListener("storage", handleStorage));
  }

  function ensure(config = {}) {
    const role = String(config.role || getRole() || "").toUpperCase();
    const loginPath = config.loginPath || loginPathForRole(role);
    if (!getAccessToken() || !role) return;

    if (state.initialized && state.role === role && state.loginPath === loginPath) {
      return;
    }

    teardown();
    state.role = role;
    state.loginPath = loginPath;
    state.scope = sessionScopeFor(role, getUserEmail());
    ensureModal();
    bindListeners();
    scheduleTimers();
    state.initialized = true;
  }

  return {
    ensure,
    teardown,
    reset,
  };
})();

window.EdgeCareSessionGuard = EdgeCareSessionGuard;

function saveSession(tokens = {}) {
  if (!tokens) return;
  if (tokens.accessToken) localStorage.setItem(ACCESS_KEY, tokens.accessToken);
  if (tokens.refreshToken) localStorage.setItem(REFRESH_KEY, tokens.refreshToken);
  if (tokens.user?.email) localStorage.setItem(EMAIL_KEY, tokens.user.email);
  if (tokens.user?.role) localStorage.setItem(ROLE_KEY, String(tokens.user.role).toUpperCase());
}

function getAccessToken() {
  return localStorage.getItem(ACCESS_KEY);
}
function getRefreshToken() {
  return localStorage.getItem(REFRESH_KEY);
}
function getRole() {
  return localStorage.getItem(ROLE_KEY);
}
function getUserEmail() {
  return localStorage.getItem(EMAIL_KEY);
}

function clearSession() {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(ROLE_KEY);
  localStorage.removeItem(EMAIL_KEY);
}

function broadcastLogout(redirectTo, reason = "manual_logout") {
  safeStorageSet(
    SESSION_LOGOUT_KEY,
    JSON.stringify({
      at: Date.now(),
      scope: sessionScopeFor(),
      role: getRole(),
      redirectTo,
      reason,
    })
  );
}

async function logout(redirectTo = "/doctor-login.html", options = {}) {
  const refreshToken = getRefreshToken();
  const finalRedirect = redirectTo || loginPathForRole(getRole());
  const reason = options?.reason || "manual_logout";
  broadcastLogout(finalRedirect, reason);
  try {
    if (refreshToken) {
      await fetch(`${API_BASE}/auth/logout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });
    }
  } catch (e) {
    // swallow network errors; we still clear session
    console.warn("Logout request failed", e);
  }
  window.EdgeCareSessionGuard?.teardown?.();
  clearSession();
  if (finalRedirect) window.location.href = finalRedirect;
}

function redirectByRole(role) {
  if (role === "DOCTOR") return "/doctor-dashboard.html";
  if (role === "PATIENT") return "/patient-dashboard.html";
  return "/doctor-login.html";
}

function requireAuth(allowedRoles = [], loginPath = "/doctor-login.html") {
  const token = getAccessToken();
  const role = getRole();

  if (!token || (allowedRoles.length && !allowedRoles.includes(role))) {
    window.EdgeCareSessionGuard?.teardown?.();
    clearSession();
    window.location.href = loginPath;
    return false;
  }
  window.EdgeCareSessionGuard?.ensure?.({ role, loginPath });
  return true;
}

function requireDoctorAuth() {
  return requireAuth(["DOCTOR"], "/doctor-login.html");
}

function requirePatientAuth() {
  return requireAuth(["PATIENT"], "/patient-login.html");
}

async function apiFetch(path, options = {}, { redirectOn401 = true, loginPath = "/doctor-login.html" } = {}) {
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

  if (res.status === 401) {
    // token expired / invalid: send back to login
    const redirectTo = loginPath || loginPathForRole(getRole());
    broadcastLogout(redirectTo, "unauthorized");
    window.EdgeCareSessionGuard?.teardown?.();
    clearSession();
    if (redirectOn401) window.location.href = redirectTo;
    return;
  }

  if (!res.ok) {
    const err = new Error(data?.message || `Request failed (${res.status})`);
    err.status = res.status;
    err.payload = data;
    throw err;
  }

  return data;
}

function escapeHtml(str){
  return String(str ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}
