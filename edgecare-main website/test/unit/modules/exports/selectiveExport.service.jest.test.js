const { exportSourceFixture } = require("../../fixtures/selectiveExport.fixtures");
const { generateSelectiveHealthReportExport } = require("../../../../src/modules/exports/selectiveExport.service");

describe("selectiveExport.service", () => {
  test("allows an authorized patient export and includes only permitted fields", async () => {
    const fetchExportData = jest.fn().mockResolvedValue(exportSourceFixture);

    const result = await generateSelectiveHealthReportExport(
      {
        actor: { id: 42, role: "PATIENT" },
        targetPatientId: 42,
      },
      { fetchExportData }
    );

    expect(fetchExportData).toHaveBeenCalledWith({
      actor: { id: 42, role: "PATIENT" },
      targetPatientId: 42,
    });
    expect(result).toEqual(
      expect.objectContaining({
        reportType: "PERSONALIZED_HEALTH_REPORT",
        patient: expect.objectContaining({
          patientId: 42,
          patientName: "Asha Patel",
          firstName: "Asha",
          lastName: "Patel",
        }),
        sections: expect.objectContaining({
          assessment: expect.objectContaining({
            condition: "Eczema",
            severity: "Moderate",
          }),
        }),
      })
    );
  });

  test("excludes restricted and sensitive fields from patient exports", async () => {
    const result = await generateSelectiveHealthReportExport({
      actor: { id: 42, role: "PATIENT" },
      targetPatientId: 42,
      sourceData: exportSourceFixture,
    });

    expect(result.raw).toBeUndefined();
    expect(result.patient.email).toBeUndefined();
    expect(result.patient.dob).toBeUndefined();
    expect(result.metadata.consentStatus).toBeUndefined();
    expect(result.patient.passwordHash).toBeUndefined();
  });

  test("rejects when authentication context is missing", async () => {
    const fetchExportData = jest.fn();

    await expect(
      generateSelectiveHealthReportExport(
        {
          actor: null,
          targetPatientId: 42,
        },
        { fetchExportData }
      )
    ).rejects.toMatchObject({
      statusCode: 401,
      message: "Not authenticated",
    });

    expect(fetchExportData).not.toHaveBeenCalled();
  });

  test("rejects unauthorized export attempts", async () => {
    const fetchExportData = jest.fn();

    await expect(
      generateSelectiveHealthReportExport(
        {
          actor: { id: 7, role: "DOCTOR" },
          targetPatientId: 42,
        },
        { fetchExportData }
      )
    ).rejects.toMatchObject({
      statusCode: 403,
      message: "Forbidden",
    });

    expect(fetchExportData).not.toHaveBeenCalled();
  });

  test("applies role-based field filtering for patient versus admin exports", async () => {
    const patientExport = await generateSelectiveHealthReportExport({
      actor: { id: 42, role: "PATIENT" },
      targetPatientId: 42,
      sourceData: exportSourceFixture,
    });
    const adminExport = await generateSelectiveHealthReportExport({
      actor: { id: 1, role: "ADMIN" },
      targetPatientId: 42,
      sourceData: exportSourceFixture,
    });

    expect(patientExport.patient.email).toBeUndefined();
    expect(patientExport.patient.dob).toBeUndefined();
    expect(patientExport.metadata.consentStatus).toBeUndefined();

    expect(adminExport.patient.email).toBe("asha@example.com");
    expect(adminExport.patient.dob).toBe("1994-06-15T00:00:00.000Z");
    expect(adminExport.metadata.consentStatus).toBe(true);
    expect(adminExport.raw).toBeUndefined();
  });
});
