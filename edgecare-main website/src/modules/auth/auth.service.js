const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { prisma } = require("../../db/prisma");
const { env } = require("../../config/env");
const { ApiError } = require("../../common/errors/ApiError");

function signAccessToken(user) {
  return jwt.sign(
    { sub: String(user.id), role: user.role, email: user.email },
    env.JWT_ACCESS_SECRET,
    { expiresIn: `${env.ACCESS_TOKEN_MIN}m` }
  );
}

function signRefreshToken(user) {
  return jwt.sign(
    { sub: String(user.id), type: "refresh" },
    env.JWT_REFRESH_SECRET,
    { expiresIn: `${env.REFRESH_TOKEN_DAYS}d` }
  );
}

function computeRefreshExpiry() {
  return new Date(Date.now() + env.REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000);
}

async function register({ email, password, role, profile = {} }) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new ApiError(409, "Email already registered");

  const passwordHash = await bcrypt.hash(password, env.BCRYPT_ROUNDS);

  const createdUser = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { email, passwordHash, role },
      select: { id: true, email: true, role: true, createdAt: true, updatedAt: true },
    });

    if (role === "ADMIN") {
      await tx.adminProfile.create({
        data: {
          adminId: user.id,
          adminLevel: profile.adminLevel || "Data Admin",
          firstName: profile.firstName,
          lastName: profile.lastName,
        },
      });
    }

    if (role === "DOCTOR") {
      const licenseNumber = profile.licenseNumber;
      const specialty = profile.specialty;

      if (!licenseNumber || !specialty) {
        throw new ApiError(400, "Doctor profile fields required: licenseNumber, specialty");
      }

      await tx.doctorProfile.create({
        data: {
          doctorId: user.id,
          firstName: profile.firstName,
          lastName: profile.lastName,
          dob: profile.dob || null,
          gender: profile.gender || null,
          licenseNumber,
          specialty,
          experience: Number(profile.experience || 0),
        },
      });
    }

    if (role === "PATIENT") {
      await tx.patientProfile.create({
        data: {
          patientId: user.id,
          firstName: profile.firstName,
          lastName: profile.lastName,
          dob: profile.dob || null,
          gender: profile.gender || null,
          language: profile.language || "en",
          consentStatus: Boolean(profile.consentStatus || false),
          allergies: profile.allergies || null,
          knownMedicalConditions: profile.knownMedicalConditions || null,
        },
      });
    }

    return user;
  });

  return createdUser;
}

async function login({ email, password, role, ipAddress = null }) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new ApiError(401, "Invalid credentials");

  if (user.role !== role) throw new ApiError(403, "Role mismatch");

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) throw new ApiError(401, "Invalid credentials");

  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);

  const tokenHash = await bcrypt.hash(refreshToken, env.BCRYPT_ROUNDS);
  const expiresAt = computeRefreshExpiry();

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt,
      ipAddress,
    },
  });

  return {
    user: { id: user.id, email: user.email, role: user.role },
    accessToken,
    refreshToken,
  };
}

/**
 * Refresh: validate refresh JWT, ensure it exists in DB (hashed), not revoked, not expired
 * Rotate refresh token (invalidate old, issue new)
 */
async function refresh({ refreshToken, ipAddress = null }) {
  if (!refreshToken) throw new ApiError(400, "Missing refresh token");

  let payload;
  try {
    payload = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET);
  } catch {
    throw new ApiError(401, "Invalid or expired refresh token");
  }

  if (payload.type !== "refresh" || !payload.sub) {
    throw new ApiError(401, "Invalid refresh token payload");
  }

  const userId = Number(payload.sub);

  // Find a matching stored refresh token by comparing hash
  const candidates = await prisma.refreshToken.findMany({
    where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
    take: 20, // limit work; adjust if needed
  });

  let matchedRow = null;
  for (const row of candidates) {
    const ok = await bcrypt.compare(refreshToken, row.tokenHash);
    if (ok) {
      matchedRow = row;
      break;
    }
  }

  if (!matchedRow) throw new ApiError(401, "Refresh token not recognized (revoked or not found)");

  // Rotate: revoke old token and issue new token pair
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new ApiError(404, "User not found");

  const newAccessToken = signAccessToken(user);
  const newRefreshToken = signRefreshToken(user);
  const newTokenHash = await bcrypt.hash(newRefreshToken, env.BCRYPT_ROUNDS);
  const newExpiresAt = computeRefreshExpiry();

  await prisma.$transaction(async (tx) => {
    await tx.refreshToken.update({
      where: { id: matchedRow.id },
      data: { revokedAt: new Date() },
    });

    await tx.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: newTokenHash,
        expiresAt: newExpiresAt,
        ipAddress,
      },
    });
  });

  return {
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
  };
}

/**
 * Logout: revoke a refresh token (match by hash)
 */
async function logout({ refreshToken }) {
  if (!refreshToken) throw new ApiError(400, "Missing refresh token");

  let payload;
  try {
    payload = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET);
  } catch {
    // If token is invalid/expired, treat as already logged out
    return { revoked: false };
  }

  const userId = Number(payload.sub);
  const candidates = await prisma.refreshToken.findMany({
    where: { userId, revokedAt: null },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  for (const row of candidates) {
    const ok = await bcrypt.compare(refreshToken, row.tokenHash);
    if (ok) {
      await prisma.refreshToken.update({
        where: { id: row.id },
        data: { revokedAt: new Date() },
      });
      return { revoked: true };
    }
  }

  return { revoked: false };
}

module.exports = { register, login, refresh, logout };
