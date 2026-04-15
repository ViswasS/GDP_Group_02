const {
  patientProfileFixture,
  aiResultFixture,
  partialAiResultFixture,
} = require("../../fixtures/healthReport.fixtures");
const { buildPersonalizedHealthReport } = require("../../../../src/modules/reports/healthReport.builder");

describe("healthReport.builder", () => {
  test("builds a personalized health report from valid AI result JSON and patient profile data", () => {
    const report = buildPersonalizedHealthReport({
      aiResult: aiResultFixture,
      patientProfile: patientProfileFixture,
      reportContext: {
        caseId: 123,
        submittedAt: "2025-04-10T10:30:00.000Z",
        status: "SUBMITTED",
      },
    });

    expect(report).toEqual(
      expect.objectContaining({
        reportType: "PERSONALIZED_HEALTH_REPORT",
        patient: expect.objectContaining({
          patientId: 42,
          patientName: "Asha Patel",
        }),
        overview: expect.objectContaining({
          caseReference: "Case #123",
          status: "SUBMITTED",
        }),
        aiSummary: "AI analysis suggests eczema with moderate severity.",
        sections: expect.objectContaining({
          assessment: expect.any(Object),
          guidance: expect.any(Object),
        }),
      })
    );
  });

  test("embeds patient-specific demographic data into the report", () => {
    const report = buildPersonalizedHealthReport({
      aiResult: aiResultFixture,
      patientProfile: patientProfileFixture,
    });

    expect(report.patient).toEqual({
      patientId: 42,
      patientName: "Asha Patel",
      firstName: "Asha",
      lastName: "Patel",
      dob: "1994-06-15T00:00:00.000Z",
      gender: "FEMALE",
      language: "English",
      allergies: "Peanuts",
      knownMedicalConditions: "Asthma",
      email: "asha@example.com",
    });
    expect(report.metadata).toEqual({
      language: "English",
      consentStatus: true,
    });
  });

  test("maps AI result fields into report sections correctly", () => {
    const report = buildPersonalizedHealthReport({
      aiResult: aiResultFixture,
      patientProfile: patientProfileFixture,
    });

    expect(report.sections.assessment).toEqual(
      expect.objectContaining({
        imageAssessment: "Image reviewed",
        condition: "Eczema",
        severity: "Moderate",
        careLevel: "Priority Review",
        confidence: 0.93,
      })
    );
    expect(report.sections.guidance).toEqual({
      nextStep: "Use a gentle moisturizer and monitor for worsening.",
      recommendations: ["Use a gentle moisturizer and monitor for worsening."],
    });
  });

  test("handles missing optional AI fields with safe fallbacks", () => {
    const report = buildPersonalizedHealthReport({
      aiResult: partialAiResultFixture,
      patientProfile: patientProfileFixture,
    });

    expect(report.aiSummary).toBe("AI analysis summary unavailable.");
    expect(report.sections.assessment).toEqual(
      expect.objectContaining({
        imageAssessment: "Image reviewed",
        condition: "Uncertain",
        severity: "Uncertain",
        careLevel: "Home care / monitor",
      })
    );
    expect(report.sections.guidance.nextStep).toBe(
      "Monitor symptoms and follow clinician guidance."
    );
    expect(report.sections.guidance.recommendations).toEqual(["Monitor symptoms and follow clinician guidance."]);
  });

  test("rejects invalid or empty AI input with a controlled validation error", () => {
    expect(() =>
      buildPersonalizedHealthReport({
        aiResult: {},
        patientProfile: patientProfileFixture,
      })
    ).toThrow("Valid AI result JSON is required");
  });
});
