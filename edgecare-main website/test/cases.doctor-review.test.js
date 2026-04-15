const test = require("node:test");
const assert = require("node:assert");

const { buildDoctorReviewMessagePayload } = require("../src/modules/cases/cases.service");

test("buildDoctorReviewMessagePayload promotes doctor severity and recommendation into patient-facing guidance", () => {
  const payload = buildDoctorReviewMessagePayload({
    id: 19,
    doctorReviewedAt: "2026-04-08T13:15:00.000Z",
    doctorSeverityOverride: "moderate",
    doctorFollowUpNeeded: true,
    doctorRecommendation: "Monitor the area for 48 hours and book a clinic review if it spreads.",
    doctorNotes: "Reddish rash visible on the hand.",
    assignedDoctor: {
      firstName: "Sandra",
      lastName: "Lee",
      user: { email: "sandra@example.com" },
    },
    mlFusedResult: {
      display: {
        triage_text: "Urgent attention",
      },
      recommended_actions: {
        care_level: "urgent_attention",
      },
    },
  });

  assert.match(payload.content, /Current severity: Moderate\./);
  assert.match(payload.content, /Care level: Priority review\./);
  assert.match(payload.content, /Recommendation: Monitor the area for 48 hours/);
  assert.equal(payload.meta.careLevel, "Priority review");
  assert.equal(payload.meta.isEmergency, false);
});

test("buildDoctorReviewMessagePayload marks severe doctor guidance as urgent", () => {
  const payload = buildDoctorReviewMessagePayload({
    id: 21,
    doctorReviewedAt: "2026-04-08T13:15:00.000Z",
    doctorSeverityOverride: "severe",
    doctorFollowUpNeeded: true,
    doctorRecommendation: "Seek immediate medical attention today.",
    doctorNotes: null,
    assignedDoctor: {
      firstName: "Asha",
      lastName: "Menon",
      user: { email: "asha@example.com" },
    },
    mlFusedResult: {
      recommended_actions: {
        care_level: "home_care",
      },
    },
  });

  assert.match(payload.content, /Care level: Urgent attention\./);
  assert.match(payload.content, /Seek urgent medical attention now if symptoms are severe or worsening\./);
  assert.equal(payload.meta.isEmergency, true);
});
