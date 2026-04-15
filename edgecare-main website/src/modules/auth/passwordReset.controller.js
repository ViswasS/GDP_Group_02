const { prisma } = require("../../db/prisma");
const { env } = require("../../config/env");
const { generateResetToken, sha256 } = require("../../utils/crypto");
const { hashPassword, isPasswordStrong } = require("../../utils/password");
const { sendPasswordResetEmail } = require("../../services/mailer");

const GENERIC_MESSAGE = "If an account exists for that email, a reset link has been sent.";

function buildBaseUrl(req) {
  const explicit = env.APP_BASE_URL && env.APP_BASE_URL.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  const origin = `${req.protocol}://${req.get("host")}`;
  return origin.replace(/\/$/, "");
}

async function forgotPassword(req, res, next) {
  try {
    const email = (req.body?.email || "").trim().toLowerCase();
    if (!email) {
      return res.status(200).json({ success: true, message: GENERIC_MESSAGE });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true },
    });

    // Always respond quickly
    res.status(200).json({ success: true, message: GENERIC_MESSAGE });

    if (!user) return;

    setImmediate(async () => {
      try {
        const { raw, hash } = generateResetToken();
        const expiresAt = new Date(Date.now() + env.RESET_TOKEN_TTL_MINUTES * 60 * 1000);

        await prisma.$transaction(async (tx) => {
          await tx.passwordResetToken.updateMany({
            where: { userId: user.id, usedAt: null },
            data: { usedAt: new Date() },
          });

          await tx.passwordResetToken.create({
            data: {
              userId: user.id,
              tokenHash: hash,
              expiresAt,
            },
          });
        });

        const resetUrl = `${buildBaseUrl(req)}/reset-password.html?token=${raw}`;

        await sendPasswordResetEmail({
          to: user.email,
          resetUrl,
          ttlMinutes: env.RESET_TOKEN_TTL_MINUTES,
        });
      } catch (err) {
        console.error("Password reset email send failed:", err.message);
      }
    });
  } catch (err) {
    next(err);
  }
}

async function verifyResetToken(req, res, next) {
  try {
    const token = (req.body?.token || "").trim();
    if (!token) return res.status(200).json({ success: true, data: { valid: false } });

    const tokenHash = sha256(token);
    const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });
    const valid = Boolean(record && !record.usedAt && record.expiresAt > new Date());

    res.status(200).json({ success: true, data: { valid } });
  } catch (err) {
    next(err);
  }
}

async function resetPassword(req, res, next) {
  try {
    const token = (req.body?.token || "").trim();
    const newPassword = req.body?.newPassword || req.body?.password || "";
    const confirmPassword = req.body?.confirmPassword || "";

    if (!token || !newPassword || !confirmPassword) {
      return res.status(400).json({ success: false, message: "Missing token or password." });
    }
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ success: false, message: "Passwords do not match." });
    }
    if (!isPasswordStrong(newPassword)) {
      return res.status(400).json({ success: false, message: "Password must be at least 8 characters." });
    }

    const tokenHash = sha256(token);
    const tokenRecord = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      select: { id: true, userId: true, usedAt: true, expiresAt: true },
    });

    if (!tokenRecord || tokenRecord.usedAt || tokenRecord.expiresAt <= new Date()) {
      return res.status(400).json({ success: false, message: "Invalid or expired token." });
    }

    const passwordHash = await hashPassword(newPassword);

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: tokenRecord.userId },
        data: { passwordHash },
      });

      await tx.passwordResetToken.update({
        where: { id: tokenRecord.id },
        data: { usedAt: new Date() },
      });

      await tx.passwordResetToken.updateMany({
        where: { userId: tokenRecord.userId, usedAt: null },
        data: { usedAt: new Date() },
      });
    });

    res.status(200).json({ success: true, message: "Password reset successful. Please login again." });
  } catch (err) {
    next(err);
  }
}

module.exports = { forgotPassword, verifyResetToken, resetPassword };
