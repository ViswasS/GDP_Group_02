const bcrypt = require("bcrypt");
const DEFAULT_ROUNDS = 12;

async function hashPassword(password) {
  return bcrypt.hash(password, DEFAULT_ROUNDS);
}

function isPasswordStrong(password) {
  return typeof password === "string" && password.length >= 8;
}

module.exports = { hashPassword, isPasswordStrong };
