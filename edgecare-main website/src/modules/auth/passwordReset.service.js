const { prisma } = require("../../db/prisma");
const { env } = require("../../config/env");
const { ApiError } = require("../../common/errors/ApiError");
const { generateResetToken, sha256 } = require("../../utils/crypto");
const { hashPassword } = require("../../utils/password");
const { sendPasswordResetEmail } = require("../../services/mailer");

const GENERIC_MESSAGE = "If an account exists for that email, a reset link has been sent.";

function buildResetUrl(rawToken) {
  const base = (env.APP_BASE_URL || "https://edgecare.onrender.com").replace(/\/$/, "");
  return `${base}/reset-password?token=${rawToken}`;
}

async function requestPasswordReset({ email, ip, userAgent }) {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true },
  });

  if (!user) {
    return { message: GENERIC_MESSAGE };
  }

  const { rawToken, tokenHash } = generateResetToken();
  const expiresAt = new Date(Date.now() + env.RESET_TOKEN_TTL_MINUTES * 60 * 1000);

  await prisma.$transaction(async (tx) => {
    await tx.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });

    await tx.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
        ip: ip || null,
        userAgent: userAgent || null,
      },
    });
  });

  const resetUrl = buildResetUrl(rawToken);
  try {
    await sendPasswordResetEmail({
      to: user.email,
      resetUrl,
      ttlMinutes: env.RESET_TOKEN_TTL_MINUTES,
    });
  } catch (err) {
    console.error("Failed to send password reset email:", err.message);
  }

  return { message: GENERIC_MESSAGE };
}

async function verifyResetToken({ token }) {
  const tokenHash = sha256(token);
  const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });

  const valid = Boolean(record && !record.usedAt && record.expiresAt > new Date());
  return { valid };
}

async function resetPassword({ token, newPassword }) {
  const tokenHash = sha256(token);
  const tokenRecord = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    select: { id: true, userId: true, usedAt: true, expiresAt: true },
  });

  if (!tokenRecord || tokenRecord.usedAt || tokenRecord.expiresAt <= new Date()) {
    throw new ApiError(400, "Invalid or expired token.");
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

  return { message: "Password reset successful. Please login again." };
}

module.exports = { requestPasswordReset, verifyResetToken, resetPassword };
