const authService = require("./auth.service");

function getClientIp(req) {
  const xf = req.headers["x-forwarded-for"];
  if (typeof xf === "string" && xf.length > 0) return xf.split(",")[0].trim();
  return req.socket?.remoteAddress || null;
}

async function register(req, res, next) {
  try {
    const { email, password, role, profile } = req.validated.body;
    const user = await authService.register({ email, password, role, profile: profile || {} });
    res.status(201).json({ success: true, data: user, message: "Registered" });
  } catch (e) {
    next(e);
  }
}

async function login(req, res, next) {
  try {
    const { email, password, role } = req.validated.body;
    const result = await authService.login({
      email,
      password,
      role,
      ipAddress: getClientIp(req),
    });
    res.json({ success: true, data: result, message: "Logged in" });
  } catch (e) {
    next(e);
  }
}

async function refresh(req, res, next) {
  try {
    const { refreshToken } = req.validated.body;
    const tokens = await authService.refresh({
      refreshToken,
      ipAddress: getClientIp(req),
    });
    res.json({ success: true, data: tokens, message: "Tokens refreshed" });
  } catch (e) {
    next(e);
  }
}

async function logout(req, res, next) {
  try {
    const { refreshToken } = req.validated.body;
    const result = await authService.logout({ refreshToken });
    res.json({ success: true, data: result, message: "Logged out" });
  } catch (e) {
    next(e);
  }
}

module.exports = { register, login, refresh, logout };
