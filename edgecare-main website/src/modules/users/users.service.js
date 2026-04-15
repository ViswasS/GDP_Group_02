const { prisma } = require("../../db/prisma");

async function getMe(userId) {
  const id = Number(userId);

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      role: true,
      mfaEnabled: true,
      createdAt: true,
      updatedAt: true,
      adminProfile: {
        select: {
          adminId: true,
          adminLevel: true,
          firstName: true,
          lastName: true,
        },
      },
      doctorProfile: {
        select: {
          doctorId: true,
          firstName: true,
          lastName: true,
          dob: true,
          gender: true,
          licenseNumber: true,
          specialty: true,
          experience: true,
        },
      },
      patientProfile: {
        select: {
          patientId: true,
          firstName: true,
          lastName: true,
          dob: true,
          gender: true,
          language: true,
          consentStatus: true,
        },
      },
    },
  });

  if (!user) return null;

  const profile = user.patientProfile || user.doctorProfile || user.adminProfile;
  const displayName =
    profile?.firstName && profile?.lastName ? `${profile.firstName} ${profile.lastName}` : null;

  return { ...user, displayName };
}

/**
 * Admin list users
 * Supports optional filter: role=DOCTOR|PATIENT|ADMIN
 * Returns only fields needed for admin assignment UI + basic admin info.
 */
async function listUsers({ role } = {}) {
  const where = {};
  if (role) where.role = role;

  return prisma.user.findMany({
    where,
    select: {
      id: true,
      email: true,
      role: true,
      createdAt: true,
      doctorProfile: {
        select: {
          doctorId: true,
          specialty: true,
          licenseNumber: true,
          experience: true,
        },
      },
      adminProfile: {
        select: {
          adminId: true,
          adminLevel: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });
}

module.exports = { getMe, listUsers };
