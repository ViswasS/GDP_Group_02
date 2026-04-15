const LONG_STANDING_LABELS = new Set(["2 weeks", "1 month", "2+ months"]);
const ENVIRONMENT_LABELS = {
  HOT_HUMID: "Hot / humid",
  DRY_LOW_HUMIDITY: "Dry / low-humidity",
  DUSTY_POLLUTION: "Dusty / pollution-heavy",
  RAINY_DAMP: "Rainy / damp",
  CHANGED_ENVIRONMENT: "Recently changed environment / traveled",
};
const EXPOSURE_LABELS = {
  SWEATING_HEAT: "Sweating / heat exposure",
  NEW_SKINCARE: "New skincare / cosmetic product",
  OUTDOOR_SUN: "Outdoor exposure / sun",
  DUST_POLLUTION: "Dust / pollution exposure",
  SEASONAL_ALLERGY: "Seasonal allergy period",
};

function hasSelectedSymptom(selectedSymptoms = [], symptom) {
  return Array.isArray(selectedSymptoms) && selectedSymptoms.includes(symptom);
}

function hasExposure(exposures = [], exposure) {
  return Array.isArray(exposures) && exposures.includes(exposure);
}

function isLongStandingDuration({ durationDays, durationLabel }) {
  if (Number.isFinite(durationDays) && durationDays >= 14) return true;
  return LONG_STANDING_LABELS.has(String(durationLabel || ""));
}

export const ENVIRONMENT_OPTIONS = [
  { value: "HOT_HUMID", label: ENVIRONMENT_LABELS.HOT_HUMID },
  { value: "DRY_LOW_HUMIDITY", label: ENVIRONMENT_LABELS.DRY_LOW_HUMIDITY },
  { value: "DUSTY_POLLUTION", label: ENVIRONMENT_LABELS.DUSTY_POLLUTION },
  { value: "RAINY_DAMP", label: ENVIRONMENT_LABELS.RAINY_DAMP },
  { value: "CHANGED_ENVIRONMENT", label: ENVIRONMENT_LABELS.CHANGED_ENVIRONMENT },
];

export const EXPOSURE_OPTIONS = [
  { value: "SWEATING_HEAT", label: EXPOSURE_LABELS.SWEATING_HEAT },
  { value: "NEW_SKINCARE", label: EXPOSURE_LABELS.NEW_SKINCARE },
  { value: "OUTDOOR_SUN", label: EXPOSURE_LABELS.OUTDOOR_SUN },
  { value: "DUST_POLLUTION", label: EXPOSURE_LABELS.DUST_POLLUTION },
  { value: "SEASONAL_ALLERGY", label: EXPOSURE_LABELS.SEASONAL_ALLERGY },
];

export function environmentLabel(value) {
  return ENVIRONMENT_LABELS[value] || value || "";
}

export function exposureLabel(value) {
  return EXPOSURE_LABELS[value] || value || "";
}

export function deriveEnvironmentGuidance({ environmentClimate, environmentalExposures = [] } = {}) {
  if (!environmentClimate && !environmentalExposures.length) return null;

  if (environmentClimate === "HOT_HUMID") {
    return {
      eyebrow: "Heat / humidity context",
      body:
        "Warm, humid environments can make sweat, friction, and moisture-related irritation more relevant. A couple of extra questions will focus on whether heat or dampness seems to worsen the area.",
    };
  }

  if (environmentClimate === "DRY_LOW_HUMIDITY") {
    return {
      eyebrow: "Dryness context",
      body:
        "Dry air can make cracking, tightness, and irritation more relevant. Extra prompts will focus on dryness-related discomfort rather than diagnosis.",
    };
  }

  if (environmentClimate === "DUSTY_POLLUTION" || hasExposure(environmentalExposures, "DUST_POLLUTION")) {
    return {
      eyebrow: "Irritation / exposure context",
      body:
        "Dust and pollution exposure can help explain when irritation or contact triggers seem worse. The questionnaire will ask one short follow-up about outdoor or dust-linked worsening.",
    };
  }

  if (environmentClimate === "RAINY_DAMP") {
    return {
      eyebrow: "Dampness context",
      body:
        "Damp or rainy conditions can make moisture and occlusion more relevant. A short follow-up will ask whether the area worsens after sweating, rain, or staying damp.",
    };
  }

  if (environmentClimate === "CHANGED_ENVIRONMENT") {
    return {
      eyebrow: "Recent change context",
      body:
        "A recent trip or environmental change can be useful intake context. A short follow-up will ask whether symptoms started after travel or a change in routine or products.",
    };
  }

  if (
    hasExposure(environmentalExposures, "NEW_SKINCARE") ||
    hasExposure(environmentalExposures, "OUTDOOR_SUN") ||
    hasExposure(environmentalExposures, "SEASONAL_ALLERGY")
  ) {
    return {
      eyebrow: "Possible trigger context",
      body:
        "These exposure details are saved as context for AI support and doctor review. They are helpful background, not a diagnosis on their own.",
    };
  }

  return null;
}

export const FOLLOW_UP_GROUPS = [
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

export function deriveVisibleFollowUpGroups(answers = {}) {
  return FOLLOW_UP_GROUPS.filter((group) => group.when(answers));
}
