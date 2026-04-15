jest.mock("../../../../src/db/prisma", () => ({
  prisma: {
    triageCase: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
  },
}));

const { prisma } = require("../../../../src/db/prisma");
const { getPatientCaseHistoryForDoctor } = require("../../../../src/modules/doctor/doctorHistory.service");

describe("doctorHistory.service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("returns patient case history for an authorized assigned doctor", async () => {
    prisma.triageCase.findFirst.mockResolvedValue({ id: 501 });
    prisma.triageCase.findMany.mockResolvedValue([
      {
        id: 101,
        patientId: 42,
        assignedDoctorId: 7,
        status: "CLOSED",
        submittedAt: "2025-04-08T09:00:00.000Z",
        intake: { title: "Older case" },
        result: { id: 1 },
        patient: { patientId: 42, firstName: "Asha", lastName: "Patel" },
        assignedDoctor: { doctorId: 7, firstName: "Rao", lastName: "Kumar" },
      },
      {
        id: 103,
        patientId: 42,
        assignedDoctorId: 7,
        status: "IN_REVIEW",
        submittedAt: "2025-04-10T12:00:00.000Z",
        intake: { title: "Newest case" },
        result: { id: 2 },
        patient: { patientId: 42, firstName: "Asha", lastName: "Patel" },
        assignedDoctor: { doctorId: 7, firstName: "Rao", lastName: "Kumar" },
      },
    ]);

    const history = await getPatientCaseHistoryForDoctor({
      actor: { id: 7, role: "DOCTOR" },
      patientId: 42,
    });

    expect(prisma.triageCase.findFirst).toHaveBeenCalledWith({
      where: {
        patientId: 42,
        assignedDoctorId: 7,
      },
      select: {
        id: true,
      },
    });
    expect(prisma.triageCase.findMany).toHaveBeenCalledWith({
      where: {
        patientId: 42,
      },
      orderBy: {
        submittedAt: "desc",
      },
      include: expect.objectContaining({
        intake: true,
        result: true,
        patient: expect.any(Object),
        assignedDoctor: expect.any(Object),
      }),
    });
    expect(history.map((item) => item.id)).toEqual([103, 101]);
  });

  test("rejects when authentication context is missing", async () => {
    await expect(
      getPatientCaseHistoryForDoctor({
        actor: null,
        patientId: 42,
      })
    ).rejects.toMatchObject({
      statusCode: 401,
      message: "Not authenticated",
    });

    expect(prisma.triageCase.findFirst).not.toHaveBeenCalled();
    expect(prisma.triageCase.findMany).not.toHaveBeenCalled();
  });

  test("rejects when the authenticated user is not a doctor", async () => {
    await expect(
      getPatientCaseHistoryForDoctor({
        actor: { id: 42, role: "PATIENT" },
        patientId: 42,
      })
    ).rejects.toMatchObject({
      statusCode: 403,
      message: "Forbidden",
    });

    expect(prisma.triageCase.findFirst).not.toHaveBeenCalled();
    expect(prisma.triageCase.findMany).not.toHaveBeenCalled();
  });

  test("rejects when the doctor is not assigned to the patient", async () => {
    prisma.triageCase.findFirst.mockResolvedValue(null);

    await expect(
      getPatientCaseHistoryForDoctor({
        actor: { id: 7, role: "DOCTOR" },
        patientId: 42,
      })
    ).rejects.toMatchObject({
      statusCode: 403,
      message: "Forbidden",
    });

    expect(prisma.triageCase.findFirst).toHaveBeenCalledWith({
      where: {
        patientId: 42,
        assignedDoctorId: 7,
      },
      select: {
        id: true,
      },
    });
    expect(prisma.triageCase.findMany).not.toHaveBeenCalled();
  });

  test("scopes the history query to the requested patient only", async () => {
    prisma.triageCase.findFirst.mockResolvedValue({ id: 501 });
    prisma.triageCase.findMany.mockResolvedValue([]);

    await getPatientCaseHistoryForDoctor({
      actor: { id: 9, role: "DOCTOR" },
      patientId: 55,
    });

    expect(prisma.triageCase.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          patientId: 55,
          assignedDoctorId: 9,
        },
      })
    );
    expect(prisma.triageCase.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          patientId: 55,
        },
      })
    );
  });
});
