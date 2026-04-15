import { API_BASE_URL } from "./config.js";

async function request(path, { method = "GET", body } = {}) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data?.message || "Request failed");
    err.data = data;
    err.status = res.status;
    throw err;
  }
  return data;
}

const forgotPassword = (email) =>
  request("/api/v1/auth/forgot-password", { method: "POST", body: { email } });

const verifyResetToken = (token) =>
  request("/api/v1/auth/reset-password/verify", { method: "POST", body: { token } });

const resetPassword = (token, newPassword, confirmPassword) =>
  request("/api/v1/auth/reset-password", {
    method: "POST",
    body: { token, newPassword, confirmPassword },
  });

export { forgotPassword, verifyResetToken, resetPassword };
