const test = require("node:test");
const assert = require("node:assert");

const { deriveAiFirstSupportState } = require("../src/modules/cases/cases.service");

test("deriveAiFirstSupportState flags clear skin / no obvious rash for re-upload-first guidance", () => {
  const result = deriveAiFirstSupportState({
    fusedResult: {
      display: {
        image_assessment: "No obvious rash detected",
      },
      recommended_actions: {},
    },
    mlImageResult: {
      image_gate: {
        top_label: "clear_or_normal_skin",
        top_score: 0.93,
      },
    },
  });

  assert.equal(result.state, "NO_OBVIOUS_RASH");
  assert.equal(result.allowReupload, true);
  assert.equal(result.allowDoctorRequest, true);
});

test("deriveAiFirstSupportState flags poor quality images for explicit re-upload guidance", () => {
  const result = deriveAiFirstSupportState({
    fusedResult: {
      display: {
        retake_required: true,
        image_assessment: "Image is blurred and needs a clearer retake",
      },
      recommended_actions: {
        retake_required: true,
      },
    },
    mlImageResult: {
      quality: "low",
    },
  });

  assert.equal(result.state, "REUPLOAD_IMAGE");
  assert.equal(result.allowReupload, true);
});

test("deriveAiFirstSupportState keeps uncertain rash-like cases in AI chat mode", () => {
  const result = deriveAiFirstSupportState({
    fusedResult: {
      display: {
        image_assessment: "Image reviewed",
      },
      recommended_actions: {
        needs_clinician_review: false,
      },
    },
    mlImageResult: {
      quality: "good",
    },
  });

  assert.equal(result.state, "AI_CHAT");
  assert.equal(result.allowAiChat, true);
  assert.equal(result.allowDoctorRequest, true);
});
