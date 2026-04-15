jest.mock("../../../../src/db/prisma", () => ({
  prisma: {
    triageCase: {
      findMany: jest.fn(),
    },
  },
}));

const { prisma } = require("../../../../src/db/prisma");
const casesService = require("../../../../src/modules/cases/cases.service");

describe("cases.service.listCasesForUser", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("returns patient cases newest-first", async () => {
    prisma.triageCase.findMany.mockResolvedValue([
      {
        id: 11,
        patientId: 42,
        status: "CLOSED",
        submittedAt: "2025-04-08T09:00:00.000Z",
        intake: { title: "Older result" },
        result: { id: 1 },
        assignedDoctor: null,
      },
      {
        id: 15,
        patientId: 42,
        status: "SUBMITTED",
        submittedAt: "2025-04-10T12:30:00.000Z",
        intake: { title: "Newest result" },
        result: { id: 2 },
        assignedDoctor: null,
      },
      {
        id: 13,
        patientId: 42,
        status: "IN_REVIEW",
        submittedAt: "2025-04-09T08:15:00.000Z",
        intake: { title: "Middle result" },
        result: { id: 3 },
        assignedDoctor: null,
      },
    ]);

    const results = await casesService.listCasesForUser({ userId: 42, role: "PATIENT" });

    expect(prisma.triageCase.findMany).toHaveBeenCalledWith({
      where: { patientId: 42 },
      orderBy: { submittedAt: "desc" },
      include: {
        intake: true,
        result: true,
        assignedDoctor: { include: { user: { select: { email: true } } } },
      },
    });
    expect(results.map((item) => item.id)).toEqual([15, 13, 11]);
  });

  test("filters by authenticated patient id in the Prisma query", async () => {
    prisma.triageCase.findMany.mockResolvedValue([]);

    await casesService.listCasesForUser({ userId: 77, role: "PATIENT" });

    expect(prisma.triageCase.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { patientId: 77 },
      })
    );
  });

  test("applies normalized fused-result output when ML data is present", async () => {
    const rawCase = {
      id: 21,
      patientId: 42,
      status: "SUBMITTED",
      submittedAt: "2025-04-10T10:00:00.000Z",
      intake: { title: "Analyzed case" },
      result: { id: 4 },
      assignedDoctor: null,
      mlImageResult: { image_gate: { top_label: "rash", top_score: 0.76 } },
      mlReport: { condition: "eczema" },
      mlFusedResult: {
        final_disease_assessment: { display_name: "Eczema", status: "confirmed", confidence_score: 0.91 },
        final_severity_level: "Moderate",
        recommended_actions: { care_level: "priority_review" },
      },
    };

    prisma.triageCase.findMany.mockResolvedValue([rawCase]);

    const results = await casesService.listCasesForUser({ userId: 42, role: "PATIENT" });

    expect(results).toHaveLength(1);
    expect(results[0].mlFusedResult).toEqual(
      expect.objectContaining({
        display: expect.objectContaining({
          condition_text: "Eczema",
          severity_text: "Moderate",
          image_assessment: expect.any(String),
        }),
      })
    );
  });

  test("returns an empty array when no analyzed results exist", async () => {
    prisma.triageCase.findMany.mockResolvedValue([]);

    const results = await casesService.listCasesForUser({ userId: 42, role: "PATIENT" });

    expect(results).toEqual([]);
  });

  test("rejects when authentication context is missing", async () => {
    await expect(casesService.listCasesForUser({ role: "PATIENT" })).rejects.toMatchObject({
      statusCode: 401,
      message: "Not authenticated",
    });

    expect(prisma.triageCase.findMany).not.toHaveBeenCalled();
  });
});
