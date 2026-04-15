const crypto = require("crypto");

function sha256(input) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function generateResetToken() {
  const raw = crypto.randomBytes(32).toString("hex");
  const hash = sha256(raw);
  return { raw, hash };
}

module.exports = { sha256, generateResetToken };
