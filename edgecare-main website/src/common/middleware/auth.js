const jwt = require("jsonwebtoken");
const { env } = require("../../config/env");

function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const [type, token] = header.split(" ");

  if (type !== "Bearer" || !token) {
    return res.status(401).json({ success: false, message: "Missing bearer token" });
  }

  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET);
    // payload: { sub, role, email, iat, exp }
    req.user = {
      id: payload.sub,
      role: payload.role,
      email: payload.email,
    };
    next();
  } catch (e) {
    return res.status(401).json({ success: false, message: "Invalid or expired token" });
  }
}

module.exports = { requireAuth };
