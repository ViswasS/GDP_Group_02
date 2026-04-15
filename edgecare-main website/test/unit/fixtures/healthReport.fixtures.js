const patientProfileFixture = {
  patientId: 42,
  firstName: "Asha",
  lastName: "Patel",
  dob: "1994-06-15T00:00:00.000Z",
  gender: "FEMALE",
  language: "English",
  consentStatus: true,
  allergies: "Peanuts",
  knownMedicalConditions: "Asthma",
  user: {
    email: "asha@example.com",
    role: "PATIENT",
  },
};

const aiResultFixture = {
  mlImageResult: {
    image_gate: {
      top_label: "rash",
      top_score: 0.88,
    },
    image_assessment_display: "Image reviewed",
  },
  mlReport: {
    condition: "eczema",
  },
  mlFusedResult: {
    final_disease_assessment: {
      display_name: "Eczema",
      status: "confirmed",
      confidence_score: 0.93,
    },
    final_severity_level: "Moderate",
    ai_summary_text: "AI analysis suggests eczema with moderate severity.",
    recommended_actions: {
      care_level: "priority_review",
      items: ["Use a gentle moisturizer and monitor for worsening."],
    },
    recommended_action: "Use a gentle moisturizer and monitor for worsening.",
  },
};

const partialAiResultFixture = {
  mlFusedResult: {
    recommended_actions: {},
  },
};

module.exports = {
  patientProfileFixture,
  aiResultFixture,
  partialAiResultFixture,
};
