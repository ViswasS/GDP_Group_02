const {
  patientProfileFixture,
  aiResultFixture,
} = require("./healthReport.fixtures");

const exportSourceFixture = {
  patientProfile: {
    ...patientProfileFixture,
    internalNotes: "do not export",
    passwordHash: "do-not-leak",
  },
  aiResult: {
    ...aiResultFixture,
    internalScore: 0.91,
  },
  reportContext: {
    caseId: 123,
    submittedAt: "2025-04-10T10:30:00.000Z",
    status: "SUBMITTED",
  },
};

module.exports = {
  exportSourceFixture,
};
