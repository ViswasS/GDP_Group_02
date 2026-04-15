jest.mock("../../../../src/db/prisma", () => ({
  prisma: {
    emergencyContact: {
      findMany: jest.fn(),
    },
  },
}));

const { prisma } = require("../../../../src/db/prisma");
const { getEmergencyContacts } = require("../../../../src/modules/patient/emergencyContacts.service");

const mockPatientUser = { id: "patient-1", role: "Patient" };
const mockOtherUser = { id: "patient-2", role: "Patient" };

const mockContacts = [
  { id: 1, name: "John", phone: "9999999999", relation: "Father", internalNote: "ignore" },
  { id: 2, name: "Jane", phone: "8888888888", relation: "Mother", internalNote: "ignore" },
];

describe("getEmergencyContacts", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns emergency contacts for the authenticated patient", async () => {
    prisma.emergencyContact.findMany.mockResolvedValue(mockContacts);

    const result = await getEmergencyContacts("patient-1", mockPatientUser);

    expect(prisma.emergencyContact.findMany).toHaveBeenCalledWith({
      where: { patientId: "patient-1" },
      orderBy: { id: "asc" },
      select: {
        name: true,
        phone: true,
        relation: true,
      },
    });
    expect(result).toHaveLength(2);
    expect(result).toEqual([
      { name: "John", phone: "9999999999", relation: "Father" },
      { name: "Jane", phone: "8888888888", relation: "Mother" },
    ]);
  });

  it("rejects access when user is not authenticated", async () => {
    await expect(getEmergencyContacts("patient-1", null)).rejects.toMatchObject({
      statusCode: 401,
      message: "Not authenticated",
    });

    expect(prisma.emergencyContact.findMany).not.toHaveBeenCalled();
  });

  it("rejects access when user is not authorized for this patient", async () => {
    await expect(getEmergencyContacts("patient-1", mockOtherUser)).rejects.toMatchObject({
      statusCode: 403,
      message: "Forbidden",
    });

    expect(prisma.emergencyContact.findMany).not.toHaveBeenCalled();
  });

  it("returns emergency contacts in expected format", async () => {
    prisma.emergencyContact.findMany.mockResolvedValue(mockContacts);

    const result = await getEmergencyContacts("patient-1", mockPatientUser);

    expect(result[0]).toEqual(
      expect.objectContaining({
        name: expect.any(String),
        phone: expect.any(String),
        relation: expect.any(String),
      })
    );
    expect(result[0].id).toBeUndefined();
    expect(result[0].internalNote).toBeUndefined();
  });
});
