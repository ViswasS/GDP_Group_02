const test = require("node:test");
const assert = require("node:assert");

const { enrichFusedResult } = require("../src/modules/cases/cases.service");

function extractDisplay(fusedResult) {
  const { fusedResult: enriched } = enrichFusedResult({ fusedResult, mlImageResult: {}, mlReport: {} });
  return enriched.display;
}

test("clear skin gate + uncertain disease/severity + self_care triage suppresses diagnosis and urgency", () => {
  const fused = {
    image_gate: { top_label: "clear_or_normal_skin", top_score: 0.95 },
    disease: { status: "uncertain", confidence: 0.413, predicted_class_display: "Hives (Urticaria)" },
    ml_analysis: {
      severity_uncertain: true,
      predicted_class: "severe",
      confidence: 0.3502,
      all_probabilities: { mild: 0.3458, moderate: 0.304, severe: 0.3502 },
    },
    triage_level: "self_care",
    needs_clinician_review: false,
    recommended_action: "Immediate medical attention required",
  };

  const display = extractDisplay(fused);

  assert.equal(display.severity_text, "Uncertain");
  assert.equal(display.show_condition_section, false);
  assert.equal(display.show_urgent_badge, false);
  assert.ok(/monitor|retake/i.test(display.next_step_text));
  assert.ok(!/immediate|urgent/.test(display.next_step_text.toLowerCase()));
});

test("clear skin self-care with severe symptom severity is suppressed to Uncertain", () => {
  const fused = {
    image_gate: { top_label: "clear_or_normal_skin", top_score: 0.95 },
    disease: { status: "uncertain", confidence: 0.3 },
    ml_analysis: { severity_uncertain: true },
    triage_level: "self_care",
    red_flags: [],
    needs_clinician_review: false,
    recommended_action: "Immediate medical attention required",
    // symptom model severe, should not leak to display
    mlSymptomsResult: { severity_level: "Severe", symptom_risk_score: 0.94 },
    final_severity_level: "Severe",
    recommended_actions: ["Immediate medical attention required"],
  };

  const display = extractDisplay(fused);
  const { fusedResult } = enrichFusedResult({ fusedResult: fused, mlImageResult: {}, mlReport: {} });

  assert.equal(display.severity_text, "Uncertain");
  assert.equal(fusedResult.final_severity_level, "Uncertain");
  assert.equal(display.show_urgent_badge, false);
  assert.match(display.next_step_text, /monitor/i);
});

test("clear skin suppression fields honored with severe symptom score", () => {
  const fused = {
    triage_level: "self_care",
    red_flags: [],
    needs_clinician_review: false,
    recommended_action: "Immediate medical attention required",
  };
  const mlImageResult = {
    image_gate: { top_label: "clear_or_normal_skin", top_score: 0.95 },
    image_analysis_suppressed: true,
    image_assessment_display: "No obvious rash detected",
    disease_display: "Uncertain",
    severity_display: "Uncertain",
    should_suppress_disease_display: true,
    should_suppress_hard_severity: true,
  };
  const mlSymptomsResult = { severity_level: "Severe", symptom_risk_score: 0.92 };

  const { fusedResult } = enrichFusedResult({ fusedResult: fused, mlImageResult, mlReport: {}, mlSymptomsResult });
  const display = fusedResult.display;

  assert.equal(display.image_assessment, "No obvious rash detected");
  assert.equal(display.condition_text, "Uncertain");
  assert.equal(display.severity_text, "Uncertain");
  assert.equal(display.show_condition_section, false);
  assert.equal(display.show_urgent_badge, false);
  assert.equal(fusedResult.final_severity_level, "Uncertain");
  assert.match(display.next_step_text, /monitor/i);
});

test("suppression but red flags keep urgency", () => {
  const fused = {
    triage_level: "urgent_attention",
    red_flags: ["fever"],
    recommended_actions: ["Immediate care"],
  };
  const mlImageResult = {
    image_gate: { top_label: "clear_or_normal_skin", top_score: 0.95 },
    image_analysis_suppressed: true,
    severity_display: "Uncertain",
    disease_display: "Uncertain",
    should_suppress_disease_display: true,
    should_suppress_hard_severity: true,
  };

  const { fusedResult } = enrichFusedResult({ fusedResult: fused, mlImageResult, mlReport: {} });
  const display = fusedResult.display;

  assert.equal(display.show_urgent_badge, true);
  assert.ok(/immediate|urgent/i.test(display.next_step_text));
});

test("severity_display overrides raw predicted_class", () => {
  const fused = {
    triage_level: "self_care",
    red_flags: [],
    needs_clinician_review: false,
  };
  const mlImageResult = {
    image_gate: { top_label: "clear_or_normal_skin", top_score: 0.95 },
    severity_display: "Uncertain",
    disease_display: "Uncertain",
    should_suppress_hard_severity: true,
    should_suppress_disease_display: true,
    predicted_class: "severe",
    ml_analysis: { predicted_class: "severe" },
  };

  const { fusedResult } = enrichFusedResult({ fusedResult: fused, mlImageResult, mlReport: {} });
  const display = fusedResult.display;

  assert.equal(display.severity_text, "Uncertain");
  assert.equal(fusedResult.final_severity_level, "Uncertain");
  assert.ok(!/severe/i.test(fusedResult.ai_summary_text || ""));
});

test("legacy fallback: clear gate high score home care no red flags suppresses", () => {
  const fused = {
    image_gate: { top_label: "clear_or_normal_skin", top_score: 0.95 },
    triage_level: "self_care",
    red_flags: [],
    needs_clinician_review: false,
    recommended_action: "Immediate medical attention required",
  };

  const { fusedResult } = enrichFusedResult({ fusedResult: fused, mlImageResult: {}, mlReport: {} });
  const display = fusedResult.display;

  assert.equal(display.severity_text, "Uncertain");
  assert.equal(display.show_urgent_badge, false);
  assert.equal(display.show_condition_section, false);
});

test("clear gate 0.85 with uncertain severity/disease suppresses", () => {
  const fused = {
    image_gate: { top_label: "clear_or_normal_skin", top_score: 0.85 },
    triage_level: "self_care",
    red_flags: [],
    needs_clinician_review: false,
  };
  const mlImageResult = {
    image_gate: { top_label: "clear_or_normal_skin", top_score: 0.85 },
    severity_display: "Uncertain",
    disease_display: "Uncertain",
    image_assessment_display: "No obvious rash detected",
  };

  const { fusedResult } = enrichFusedResult({ fusedResult: fused, mlImageResult, mlReport: {} });
  const display = fusedResult.display;

  assert.equal(display.severity_text, "Uncertain");
  assert.equal(display.condition_text, "Uncertain");
  assert.equal(display.show_condition_section, false);
  assert.equal(display.show_urgent_badge, false);
  assert.equal(fusedResult.final_severity_level, "Uncertain");
});

test("clear gate 0.86 suppressed payload stays non-urgent", () => {
  const fused = {
    triage_level: "self_care",
    red_flags: [],
    needs_clinician_review: false,
  };
  const mlImageResult = {
    image_gate: { top_label: "clear_or_normal_skin", top_score: 0.86 },
    image_analysis_suppressed: true,
    severity_display: "Uncertain",
    disease_display: "Uncertain",
    should_suppress_disease_display: true,
    should_suppress_hard_severity: true,
  };

  const { fusedResult } = enrichFusedResult({ fusedResult: fused, mlImageResult, mlReport: {} });
  const display = fusedResult.display;

  assert.equal(display.severity_text, "Uncertain");
  assert.equal(display.condition_text, "Uncertain");
  assert.equal(display.show_condition_section, false);
  assert.equal(display.show_urgent_badge, false);
});

test("below threshold does not auto-suppress", () => {
  const fused = {
    image_gate: { top_label: "clear_or_normal_skin", top_score: 0.80 },
    triage_level: "self_care",
    red_flags: [],
    needs_clinician_review: false,
  };
  const mlImageResult = {
    image_gate: { top_label: "clear_or_normal_skin", top_score: 0.80 },
    severity_display: "Moderate",
    disease_display: "Eczema",
  };

  const { fusedResult } = enrichFusedResult({ fusedResult: fused, mlImageResult, mlReport: {} });
  const display = fusedResult.display;

  assert.notEqual(display.severity_text, "Uncertain");
});

test("red flag still urgent even when clear gate", () => {
  const fused = {
    triage_level: "urgent_attention",
    red_flags: ["fever"],
    needs_clinician_review: true,
  };
  const mlImageResult = {
    image_gate: { top_label: "clear_or_normal_skin", top_score: 0.9 },
    severity_display: "Uncertain",
    disease_display: "Uncertain",
  };

  const { fusedResult } = enrichFusedResult({ fusedResult: fused, mlImageResult, mlReport: {} });
  const display = fusedResult.display;

  assert.equal(display.show_urgent_badge, true);
});

test("rash image with uncertain disease and severity stays uncertain", () => {
  const fused = {
    image_gate: { top_label: "rash", top_score: 0.42 },
    disease: { status: "uncertain", confidence: 0.5, predicted_class_display: "Eczema" },
    ml_analysis: {
      severity_uncertain: true,
      predicted_class: "moderate",
      confidence: 0.45,
      all_probabilities: { mild: 0.4, moderate: 0.35, severe: 0.25 },
    },
    triage_level: "priority_review",
  };

  const display = extractDisplay(fused);

  assert.equal(display.severity_text, "Uncertain");
  assert.equal(display.show_condition_section, false);
  assert.match(display.condition_text, /uncertain/i);
});

test("red flag case keeps urgent messaging", () => {
  const fused = {
    image_gate: { top_label: "rash", top_score: 0.2 },
    final_disease_assessment: { display_name: "Cellulitis", status: "confirmed", confidence_score: 0.92 },
    final_severity_level: "Severe",
    triage_level: "urgent_attention",
    red_flags: ["fever"],
    recommended_actions: ["Immediate medical attention required"],
    recommended_action: "Immediate medical attention required",
  };

  const display = extractDisplay(fused);

  assert.equal(display.show_urgent_badge, true);
  assert.equal(display.severity_text, "Severe");
  assert.ok(/immediate|urgent/i.test(display.next_step_text));
});

test("urgent red flag plus severe symptoms keeps urgency", () => {
  const fused = {
    image_gate: { top_label: "rash", top_score: 0.2 },
    final_disease_assessment: { display_name: "Cellulitis", status: "confirmed", confidence_score: 0.92 },
    final_severity_level: "Severe",
    triage_level: "urgent_attention",
    red_flags: ["fever"],
    recommended_actions: ["Immediate medical attention required"],
    recommended_action: "Immediate medical attention required",
    mlSymptomsResult: { severity_level: "Severe", symptom_risk_score: 0.9 },
  };

  const { fusedResult } = enrichFusedResult({ fusedResult: fused, mlImageResult: {}, mlReport: {} });
  const display = fusedResult.display;

  assert.equal(display.show_urgent_badge, true);
  assert.equal(display.severity_text, "Severe");
  assert.ok(/immediate|urgent/i.test(display.next_step_text));
});

test("rash image confident severity unaffected", () => {
  const fused = {
    image_gate: { top_label: "rash", top_score: 0.2 },
    final_disease_assessment: { display_name: "Hives", status: "confirmed", confidence_score: 0.91 },
    final_severity_level: "Moderate",
    triage_level: "priority_review",
    recommended_actions: ["Apply cold compress"],
    mlSymptomsResult: { severity_level: "Moderate", symptom_risk_score: 0.8 },
  };

  const { fusedResult } = enrichFusedResult({ fusedResult: fused, mlImageResult: {}, mlReport: {} });
  const display = fusedResult.display;

  assert.equal(display.show_condition_section, true);
  assert.equal(display.condition_text, "Hives");
  assert.equal(display.severity_text, "Moderate");
  assert.equal(display.show_urgent_badge, false);
});

test("confident disease and severity flow through normally", () => {
  const fused = {
    image_gate: { top_label: "rash", top_score: 0.2 },
    final_disease_assessment: { display_name: "Hives", status: "confirmed", confidence_score: 0.91 },
    final_severity_level: "Moderate",
    triage_level: "priority_review",
    recommended_actions: ["Apply cold compress"],
  };

  const display = extractDisplay(fused);

  assert.equal(display.show_condition_section, true);
  assert.equal(display.condition_text, "Hives");
  assert.equal(display.severity_text, "Moderate");
  assert.equal(display.show_urgent_badge, false);
  assert.match(display.next_step_text, /cold compress/i);
});
