const { prisma } = require("../../db/prisma");
const { ApiError } = require("../../common/errors/ApiError");

async function getEmergencyContacts(patientId, userContext) {
  const targetPatientId = String(patientId || "").trim();
  const actorId = String(userContext?.id || "").trim();
  const actorRole = String(userContext?.role || "").trim().toUpperCase();

  if (!actorId || !actorRole) {
    throw new ApiError(401, "Not authenticated");
  }

  if (actorRole !== "PATIENT" || actorId !== targetPatientId) {
    throw new ApiError(403, "Forbidden");
  }

  const contacts = await prisma.emergencyContact.findMany({
    where: { patientId: targetPatientId },
    orderBy: { id: "asc" },
    select: {
      name: true,
      phone: true,
      relation: true,
    },
  });

  return contacts.map((contact) => ({
    name: contact.name,
    phone: contact.phone,
    relation: contact.relation,
  }));
}

module.exports = { getEmergencyContacts };
