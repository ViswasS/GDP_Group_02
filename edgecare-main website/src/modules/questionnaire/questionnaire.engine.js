const LONG_STANDING_LABELS = new Set(["2 weeks", "1 month", "2+ months"]);

function hasSelectedSymptom(selectedSymptoms = [], symptom) {
  return Array.isArray(selectedSymptoms) && selectedSymptoms.includes(symptom);
}

function hasExposure(exposures = [], exposure) {
  return Array.isArray(exposures) && exposures.includes(exposure);
}

function isLongStandingDuration({ durationDays, durationLabel } = {}) {
  if (Number.isFinite(durationDays) && durationDays >= 14) return true;
  return LONG_STANDING_LABELS.has(String(durationLabel || ""));
}

const FOLLOW_UP_GROUPS = [
  {
    id: "itching",
    title: "Itching follow-up",
    note: "Because itching is part of this case, a couple of extra details help improve the intake summary.",
    when: ({ selectedSymptoms }) => hasSelectedSymptom(selectedSymptoms, "Itching"),
    fields: [
      {
        key: "severity",
        label: "How intense is the itching?",
        type: "choice",
        options: ["Mild", "Moderate", "Severe"],
      },
      {
        key: "worseAtNight",
        label: "Is the itching worse at night?",
        type: "boolean",
        trueLabel: "Yes",
        falseLabel: "No",
      },
    ],
  },
  {
    id: "pain",
    title: "Pain or tenderness follow-up",
    note: "Because pain or burning is present, this helps capture whether the area feels inflamed or tender.",
    when: ({ selectedSymptoms }) =>
      hasSelectedSymptom(selectedSymptoms, "Pain") || hasSelectedSymptom(selectedSymptoms, "Burning"),
    fields: [
      {
        key: "warm",
        label: "Does the area feel warm?",
        type: "boolean",
        trueLabel: "Yes",
        falseLabel: "No",
      },
      {
        key: "swollen",
        label: "Does the area look or feel swollen?",
        type: "boolean",
        trueLabel: "Yes",
        falseLabel: "No",
      },
      {
        key: "painfulToTouch",
        label: "Is it painful to touch?",
        type: "boolean",
        trueLabel: "Yes",
        falseLabel: "No",
      },
    ],
  },
  {
    id: "spreading",
    title: "Spreading follow-up",
    note: "Because the area may be spreading, this helps identify whether it is changing quickly.",
    when: ({ spreadingStatus }) => spreadingStatus === "SPREADING",
    fields: [
      {
        key: "spreadQuickly",
        label: "Has it spread quickly in the last 24 to 72 hours?",
        type: "boolean",
        trueLabel: "Yes",
        falseLabel: "No",
      },
    ],
  },
  {
    id: "history",
    title: "History follow-up",
    note: "Because this has been going on for longer, it helps to know whether it has happened before.",
    when: (answers) => isLongStandingDuration(answers),
    fields: [
      {
        key: "happenedBefore",
        label: "Has this happened before?",
        type: "boolean",
        trueLabel: "Yes",
        falseLabel: "No",
      },
    ],
  },
  {
    id: "urgent",
    title: "Urgent symptom follow-up",
    note: "These extra answers help the system prioritize urgent support safely.",
    alert:
      "If you have trouble breathing, rapid swelling of the face or lips, or severe worsening symptoms, seek emergency help immediately.",
    when: ({ selectedSymptoms, isEmergency }) =>
      Boolean(isEmergency) ||
      hasSelectedSymptom(selectedSymptoms, "Fever/Chills") ||
      hasSelectedSymptom(selectedSymptoms, "Swelling"),
    fields: [
      {
        key: "feverPresent",
        label: "Is fever currently present?",
        type: "boolean",
        trueLabel: "Yes",
        falseLabel: "No",
      },
      {
        key: "breathingOrFaceSwelling",
        label: "Any breathing difficulty or fast swelling of the face, lips, or eyes?",
        type: "boolean",
        trueLabel: "Yes",
        falseLabel: "No",
      },
    ],
  },
  {
    id: "environmentHotHumid",
    title: "Heat and humidity follow-up",
    note: "Because a hot or humid environment was selected, this checks whether sweat or friction seems to make the area worse.",
    when: ({ environmentClimate, environmentalExposures }) =>
      environmentClimate === "HOT_HUMID" || hasExposure(environmentalExposures, "SWEATING_HEAT"),
    fields: [
      {
        key: "worseWithSweatOrFriction",
        label: "Does it seem worse after sweating, heat, or skin friction?",
        type: "boolean",
        trueLabel: "Yes",
        falseLabel: "No",
      },
    ],
  },
  {
    id: "environmentDry",
    title: "Dry climate follow-up",
    note: "Because dry conditions were selected, this captures whether the skin feels tight, cracked, or more irritated than usual.",
    when: ({ environmentClimate }) => environmentClimate === "DRY_LOW_HUMIDITY",
    fields: [
      {
        key: "drynessOrCracking",
        label: "Does the area feel unusually dry, tight, or cracked?",
        type: "boolean",
        trueLabel: "Yes",
        falseLabel: "No",
      },
    ],
  },
  {
    id: "environmentDust",
    title: "Dust or pollution follow-up",
    note: "Because dust or pollution exposure was selected, this helps capture whether symptoms seem linked to outdoor or contact exposure.",
    when: ({ environmentClimate, environmentalExposures }) =>
      environmentClimate === "DUSTY_POLLUTION" || hasExposure(environmentalExposures, "DUST_POLLUTION"),
    fields: [
      {
        key: "worseAfterDustOrOutdoorExposure",
        label: "Does it feel worse after outdoor activity, dust, or pollution exposure?",
        type: "boolean",
        trueLabel: "Yes",
        falseLabel: "No",
      },
    ],
  },
  {
    id: "environmentDamp",
    title: "Rainy or damp follow-up",
    note: "Because damp conditions were selected, this checks whether moisture or staying in wet clothing seems to worsen the area.",
    when: ({ environmentClimate }) => environmentClimate === "RAINY_DAMP",
    fields: [
      {
        key: "worseWhenDamp",
        label: "Does it seem worse after rain, sweat, or staying damp for a while?",
        type: "boolean",
        trueLabel: "Yes",
        falseLabel: "No",
      },
    ],
  },
  {
    id: "environmentChange",
    title: "Recent change follow-up",
    note: "Because recent travel or an environmental change was selected, this checks whether the timing matches a new place, routine, or product.",
    when: ({ environmentClimate }) => environmentClimate === "CHANGED_ENVIRONMENT",
    fields: [
      {
        key: "startedAfterTravelOrChange",
        label: "Did this start after travel, a new stay, or a recent change in routine or products?",
        type: "boolean",
        trueLabel: "Yes",
        falseLabel: "No",
      },
    ],
  },
];

function normalizeAnswers(answers = {}) {
  if (!answers || typeof answers !== "object" || Array.isArray(answers)) {
    return null;
  }

  return {
    selectedSymptoms: Array.isArray(answers.selectedSymptoms) ? answers.selectedSymptoms : [],
    spreadingStatus: answers.spreadingStatus,
    durationDays: Number.isFinite(answers.durationDays) ? answers.durationDays : answers.durationDays,
    durationLabel: answers.durationLabel,
    isEmergency: Boolean(answers.isEmergency),
    environmentClimate: answers.environmentClimate,
    environmentalExposures: Array.isArray(answers.environmentalExposures) ? answers.environmentalExposures : [],
  };
}

function deriveVisibleFollowUpGroups(answers = {}) {
  const normalized = normalizeAnswers(answers);
  if (!normalized) return [];
  return FOLLOW_UP_GROUPS.filter((group) => group.when(normalized));
}

function deriveNextFollowUpQuestion(answers = {}, answeredGroupIds = []) {
  const normalized = normalizeAnswers(answers);
  if (!normalized) {
    return {
      complete: false,
      nextQuestion: null,
      remainingGroups: [],
      error: "Invalid questionnaire answers",
    };
  }

  const visibleGroups = deriveVisibleFollowUpGroups(normalized);
  const answered = new Set(Array.isArray(answeredGroupIds) ? answeredGroupIds : []);
  const remainingGroups = visibleGroups.filter((group) => !answered.has(group.id));
  const nextGroup = remainingGroups[0] || null;

  return {
    complete: remainingGroups.length === 0,
    nextQuestion: nextGroup
      ? {
          id: nextGroup.id,
          title: nextGroup.title,
          note: nextGroup.note || null,
          alert: nextGroup.alert || null,
          fields: nextGroup.fields,
        }
      : null,
    remainingGroups,
    error: null,
  };
}

module.exports = {
  FOLLOW_UP_GROUPS,
  deriveVisibleFollowUpGroups,
  deriveNextFollowUpQuestion,
};
