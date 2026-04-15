const { prisma } = require("../../db/prisma");

async function getProfile(userId) {
  const id = Number(userId);

  return prisma.doctorProfile.findUnique({
    where: { doctorId: id },
    select: {
      doctorId: true,
      firstName: true,
      lastName: true,
      dob: true,
      gender: true,
      licenseNumber: true,
      specialty: true,
      experience: true,
      user: {
        select: {
          id: true,
          email: true,
          role: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    },
  });
}

async function updateProfile(userId, patch = {}) {
  const id = Number(userId);

  const data = {};
  const fields = [
    "firstName",
    "lastName",
    "dob",
    "gender",
    "licenseNumber",
    "specialty",
    "experience",
  ];
  for (const key of fields) {
    if (patch[key] !== undefined) data[key] = patch[key];
  }

  const updated = await prisma.doctorProfile
    .update({
      where: { doctorId: id },
      data,
      select: {
        doctorId: true,
        firstName: true,
        lastName: true,
        dob: true,
        gender: true,
        licenseNumber: true,
        specialty: true,
        experience: true,
        user: {
          select: {
            id: true,
            email: true,
            role: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    })
    .catch((e) => {
      if (e.code === "P2025") return null;
      throw e;
    });

  return updated;
}

module.exports = { getProfile, updateProfile };
