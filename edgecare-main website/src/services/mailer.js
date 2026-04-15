const nodemailer = require("nodemailer");
const { env } = require("../config/env");

const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_SECURE, // false for STARTTLS on 587
  auth: {
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
  },
  connectionTimeout: 8000,
  greetingTimeout: 8000,
  socketTimeout: 8000,
  tls: { rejectUnauthorized: true },
});

function buildResetEmail(resetUrl, ttlMinutes) {
  const text = [
    "We received a request to reset your EdgeCare password.",
    `This link expires in ${ttlMinutes} minutes:`,
    resetUrl,
    "",
    "If you did not request this, you can ignore this email.",
  ].join("\n");

  const html = `
    <div style="font-family: Arial, sans-serif; line-height:1.6; color:#0f172a;">
      <p>We received a request to reset your EdgeCare password.</p>
      <p style="margin:16px 0;">
        <a href="${resetUrl}" style="background:#2563eb;color:#fff;padding:12px 18px;border-radius:6px;text-decoration:none;">
          Reset your password
        </a>
      </p>
      <p>This link will expire in ${ttlMinutes} minutes.</p>
      <p>If the button doesn't work, copy and paste this link:</p>
      <p style="word-break:break-all;">${resetUrl}</p>
      <p>If you didn't request this, you can ignore this email.</p>
    </div>
  `;

  return { text, html };
}

async function sendPasswordResetEmail({ to, resetUrl, ttlMinutes }) {
  const { text, html } = buildResetEmail(resetUrl, ttlMinutes);
  try {
    await transporter.sendMail({
      from: env.SMTP_FROM || env.SMTP_USER,
      to,
      subject: "Reset your EdgeCare password",
      text,
      html,
    });
    return true;
  } catch (err) {
    console.error("Password reset email failed:", err.message);
    return false;
  }
}

module.exports = { sendPasswordResetEmail };
