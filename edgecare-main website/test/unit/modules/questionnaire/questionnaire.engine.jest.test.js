const {
  deriveVisibleFollowUpGroups,
  deriveNextFollowUpQuestion,
} = require("../../../../src/modules/questionnaire/questionnaire.engine");

describe("questionnaire.engine", () => {
  test("generates the urgent fever follow-up for the fever path", () => {
    const result = deriveNextFollowUpQuestion({
      selectedSymptoms: ["Fever/Chills"],
    });

    expect(result.complete).toBe(false);
    expect(result.error).toBeNull();
    expect(result.nextQuestion).toEqual(
      expect.objectContaining({
        id: "urgent",
        title: "Urgent symptom follow-up",
      })
    );
    expect(result.nextQuestion.fields.map((field) => field.key)).toEqual(["feverPresent", "breathingOrFaceSwelling"]);
  });

  test("generates the skin-condition itching follow-up for the skin condition path", () => {
    const result = deriveNextFollowUpQuestion({
      selectedSymptoms: ["Itching"],
    });

    expect(result.complete).toBe(false);
    expect(result.error).toBeNull();
    expect(result.nextQuestion).toEqual(
      expect.objectContaining({
        id: "itching",
        title: "Itching follow-up",
      })
    );
    expect(result.nextQuestion.fields.map((field) => field.key)).toEqual(["severity", "worseAtNight"]);
  });

  test("produces different branches for fever and skin-condition answers", () => {
    const fever = deriveNextFollowUpQuestion({
      selectedSymptoms: ["Fever/Chills"],
    });
    const skin = deriveNextFollowUpQuestion({
      selectedSymptoms: ["Itching"],
    });

    expect(fever.nextQuestion.id).toBe("urgent");
    expect(skin.nextQuestion.id).toBe("itching");
    expect(fever.nextQuestion.id).not.toBe(skin.nextQuestion.id);
  });

  test("handles invalid answers safely with a controlled result", () => {
    const result = deriveNextFollowUpQuestion("not-an-answer-object");

    expect(result).toEqual({
      complete: false,
      nextQuestion: null,
      remainingGroups: [],
      error: "Invalid questionnaire answers",
    });
  });

  test("returns completion when the current branch has no remaining follow-up questions", () => {
    const visibleGroups = deriveVisibleFollowUpGroups({
      selectedSymptoms: ["Fever/Chills"],
    });
    const result = deriveNextFollowUpQuestion(
      {
        selectedSymptoms: ["Fever/Chills"],
      },
      visibleGroups.map((group) => group.id)
    );

    expect(result.complete).toBe(true);
    expect(result.nextQuestion).toBeNull();
    expect(result.remainingGroups).toEqual([]);
    expect(result.error).toBeNull();
  });
});
