jest.mock("../../../../src/db/prisma", () => ({
  prisma: {
    patientProfile: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));

const { prisma } = require("../../../../src/db/prisma");
const { updateProfile } = require("../../../../src/modules/patient/patient.service");

describe("patient.service.updateProfile", () => {
  const actor = { id: 42, role: "PATIENT", email: "patient@example.com" };

  const updatedProfile = {
    patientId: 42,
    firstName: "Asha",
    lastName: "Patel",
    dob: "1990-06-15T00:00:00.000Z",
    gender: "FEMALE",
    language: "English",
    consentStatus: true,
    allergies: "Peanuts",
    knownMedicalConditions: "Asthma",
    user: {
      id: 42,
      email: "patient@example.com",
      role: "PATIENT",
      createdAt: "2026-03-01T00:00:00.000Z",
      updatedAt: "2026-04-01T00:00:00.000Z",
    },
  };

  const expectedSelect = {
    patientId: true,
    firstName: true,
    lastName: true,
    dob: true,
    gender: true,
    language: true,
    consentStatus: true,
    allergies: true,
    knownMedicalConditions: true,
    user: {
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("updates an authorized patient profile and persists only allowed fields", async () => {
    const patch = {
      firstName: "Asha",
      lastName: "Patel",
      language: "English",
      consentStatus: true,
      allergies: "Peanuts",
      knownMedicalConditions: "Asthma",
      ignoredField: "should not persist",
    };

    prisma.patientProfile.findUnique.mockResolvedValue({ patientId: 42 });
    prisma.patientProfile.update.mockResolvedValue(updatedProfile);

    const result = await updateProfile(actor, patch);

    expect(prisma.patientProfile.findUnique).toHaveBeenCalledWith({
      where: { patientId: 42 },
      select: { patientId: true },
    });
    expect(prisma.patientProfile.update).toHaveBeenCalledWith({
      where: { patientId: 42 },
      data: {
        firstName: "Asha",
        lastName: "Patel",
        language: "English",
        consentStatus: true,
        allergies: "Peanuts",
        knownMedicalConditions: "Asthma",
      },
      select: expectedSelect,
    });
    expect(result).toEqual(updatedProfile);
  });

  test("rejects when authenticated user context is missing", async () => {
    await expect(updateProfile(null, { firstName: "Asha" })).rejects.toMatchObject({
      statusCode: 401,
      message: "Not authenticated",
    });

    expect(prisma.patientProfile.findUnique).not.toHaveBeenCalled();
    expect(prisma.patientProfile.update).not.toHaveBeenCalled();
  });

  test("rejects when a patient tries to update another patient's profile", async () => {
    await expect(updateProfile(actor, { firstName: "Blocked" }, { patientId: 99 })).rejects.toMatchObject({
      statusCode: 403,
      message: "Forbidden",
    });

    expect(prisma.patientProfile.findUnique).not.toHaveBeenCalled();
    expect(prisma.patientProfile.update).not.toHaveBeenCalled();
  });

  test("throws not found when the patient profile does not exist", async () => {
    prisma.patientProfile.findUnique.mockResolvedValue(null);

    await expect(updateProfile(actor, { language: "Hindi" })).rejects.toMatchObject({
      statusCode: 404,
      message: "Profile not found",
    });

    expect(prisma.patientProfile.findUnique).toHaveBeenCalledWith({
      where: { patientId: 42 },
      select: { patientId: true },
    });
    expect(prisma.patientProfile.update).not.toHaveBeenCalled();
  });

  test("throws validation error when no valid profile fields are provided", async () => {
    await expect(updateProfile(actor, { invalidField: "value" })).rejects.toMatchObject({
      statusCode: 400,
      message: "No valid profile fields provided",
    });

    expect(prisma.patientProfile.findUnique).not.toHaveBeenCalled();
    expect(prisma.patientProfile.update).not.toHaveBeenCalled();
  });
});
