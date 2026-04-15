jest.mock("../../../../src/db/prisma", () => {
  const tx = {
    patientProfile: {
      findUnique: jest.fn(),
    },
    caseIntake: {
      create: jest.fn(),
    },
    triageCase: {
      create: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
  };

  return {
    prisma: {
      $transaction: jest.fn((callback) => callback(tx)),
    },
    __tx: tx,
  };
});

const { prisma, __tx } = require("../../../../src/db/prisma");
const { createCase } = require("../../../../src/modules/cases/cases.service");

describe("cases.service.createCase", () => {
  const basePayload = {
    userId: 42,
    title: "New rash on arm",
    durationDays: 3,
    isEmergency: false,
    symptoms: ["itching", "redness"],
    severity: 4,
    itchiness: 6,
    spreadingStatus: "SAME",
    triggers: "unknown",
    imageUrls: ["https://example.com/rash-1.jpg"],
  };

  const createdCase = {
    id: 123,
    status: "SUBMITTED",
    patientId: 42,
    intakeId: 9001,
    intake: { id: 9001, title: "New rash on arm" },
    result: null,
    images: [],
    patient: {
      patientId: 42,
      firstName: "Asha",
      lastName: "Patel",
      allergies: null,
      knownMedicalConditions: null,
      user: { email: "patient@example.com", role: "PATIENT" },
    },
    assignedDoctor: null,
    reviews: [],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation((callback) => callback(__tx));
    __tx.patientProfile.findUnique.mockResolvedValue({ patientId: 42 });
    __tx.caseIntake.create.mockResolvedValue({ id: 9001 });
    __tx.triageCase.create.mockResolvedValue(createdCase);
    __tx.auditLog.create.mockResolvedValue({ id: 1 });
  });

  test("creates a case for an authenticated patient and returns a valid case id with submitted status", async () => {
    const result = await createCase(basePayload);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(__tx.patientProfile.findUnique).toHaveBeenCalledWith({
      where: { patientId: 42 },
      select: { patientId: true },
    });
    expect(__tx.caseIntake.create).toHaveBeenCalledWith({
      data: {
        title: "New rash on arm",
        isActive: true,
        duration: "3",
        medications: null,
      },
      select: { id: true },
    });
    expect(__tx.triageCase.create).toHaveBeenCalledWith({
      data: {
        patientId: 42,
        intakeId: 9001,
        isEmergency: false,
        status: "SUBMITTED",
        rashLocation: null,
        durationLabel: null,
        symptoms: ["itching", "redness"],
        severity: 4,
        itchiness: 6,
        spreadingStatus: "SAME",
        triggers: "unknown",
        imageUrls: ["https://example.com/rash-1.jpg"],
        mlImageResult: null,
        mlSymptomsResult: null,
        mlFusedResult: null,
        mlReport: null,
      },
      include: expect.objectContaining({
        intake: true,
        result: true,
        images: true,
        patient: expect.any(Object),
        assignedDoctor: expect.any(Object),
        reviews: true,
      }),
    });
    expect(result).toEqual(createdCase);
    expect(result.id).toBe(123);
    expect(result.status).toBe("SUBMITTED");
  });

  test("rejects when authentication context is missing", async () => {
    await expect(createCase({ title: "New rash on arm" })).rejects.toMatchObject({
      statusCode: 401,
      message: "Not authenticated",
    });

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(__tx.caseIntake.create).not.toHaveBeenCalled();
    expect(__tx.triageCase.create).not.toHaveBeenCalled();
  });

  test("rejects when required case fields are missing", async () => {
    await expect(createCase({ userId: 42 })).rejects.toMatchObject({
      statusCode: 400,
      message: "Title is required",
    });

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(__tx.caseIntake.create).not.toHaveBeenCalled();
    expect(__tx.triageCase.create).not.toHaveBeenCalled();
  });

  test("rejects when the authenticated user has no patient profile", async () => {
    __tx.patientProfile.findUnique.mockResolvedValue(null);

    await expect(createCase(basePayload)).rejects.toMatchObject({
      statusCode: 403,
      message: "Only PATIENT can create cases (patient profile missing)",
    });

    expect(__tx.patientProfile.findUnique).toHaveBeenCalledWith({
      where: { patientId: 42 },
      select: { patientId: true },
    });
    expect(__tx.caseIntake.create).not.toHaveBeenCalled();
    expect(__tx.triageCase.create).not.toHaveBeenCalled();
  });

  test("uses SUBMITTED as the default processing state for new cases", async () => {
    await createCase(basePayload);

    expect(__tx.triageCase.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "SUBMITTED",
        }),
      })
    );
  });
});
