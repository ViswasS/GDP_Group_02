# Mobile Dynamic Questionnaire Task

## A. Feature overview

### What was added in web
- The patient case intake form now supports a stronger structured base questionnaire plus progressive follow-up questions.
- Base intake remains simple and includes duration, severity, itchiness, spreading status, symptom selection, medications, triggers, and additional notes.
- Follow-up questions now appear conditionally for a small set of useful cases:
  - itching
  - pain or burning
  - spreading
  - long-standing duration
  - urgent-style symptoms

### Why it improves intake quality
- It captures better context without forcing every patient through a long interview.
- It preserves a clean intake experience for simple cases.
- It gives AI support and future doctor review a more structured symptom payload when follow-up questions are relevant.

## B. Base questionnaire fields

### Required / common fields used in web
- `title`
- `duration`
- `durationDays`
- `durationLabel`
- `rashLocation`
- `medications`
- `triggers`
- `description` at the form layer, represented in the structured symptom payload as `additionalNotes`
- `isEmergency`
- `severity`
- `itchiness`
- `spreadingStatus`
- symptom chip selections

### Symptom chip selections currently shown
- `Redness`
- `Swelling`
- `Itching`
- `Burning`
- `Blisters`
- `Dryness/Scaling`
- `Pain`
- `Fever/Chills`

## C. Conditional follow-up logic

### Itching follow-up
- Trigger:
  - symptom selection includes `Itching`
- Extra questions:
  - itching severity: `Mild | Moderate | Severe`
  - worse at night: `Yes | No`

### Pain / burning follow-up
- Trigger:
  - symptom selection includes `Pain` or `Burning`
- Extra questions:
  - does the area feel warm?
  - does the area look or feel swollen?
  - is it painful to touch?

### Spreading follow-up
- Trigger:
  - `spreadingStatus === "SPREADING"`
- Extra question:
  - has it spread quickly in the last 24 to 72 hours?

### History follow-up
- Trigger:
  - duration is long-standing
  - web currently treats this as:
    - `durationDays >= 14`, or
    - `durationLabel` is `2 weeks`, `1 month`, or `2+ months`
- Extra question:
  - has this happened before?

### Urgent symptom follow-up
- Trigger:
  - `isEmergency === true`, or
  - symptom selection includes `Fever/Chills`, or
  - symptom selection includes `Swelling`
- Extra questions:
  - is fever currently present?
  - any breathing difficulty or fast swelling of the face, lips, or eyes?

## D. Data contract

### Payload field mobile must submit
- Reuse the existing `symptoms` field, but now submit it as structured JSON when follow-ups are available.

### Supported `symptoms` payload shapes
- Legacy shape still accepted:
```json
["Itching", "Redness"]
```

- New structured shape:
```json
{
  "selected": ["Itching", "Pain"],
  "followUps": {
    "itching": {
      "severity": "Severe",
      "worseAtNight": true
    },
    "pain": {
      "warm": true,
      "swollen": false,
      "painfulToTouch": true
    }
  },
  "additionalNotes": "Started after travel and feels worse after showers."
}
```

### Optional follow-up representation
- Follow-up groups appear only when triggered.
- Optional unanswered fields may be omitted entirely.
- If no follow-up groups are triggered, mobile may still submit only the base fields and the legacy symptom array or the structured object with `selected` only.

## E. Mobile UI requirements

### Progressive reveal behavior
- Keep the base questionnaire visible first.
- Reveal follow-up groups only after the triggering answers are selected.
- Group follow-up questions into small stacked cards or sections with a short explanation of why extra questions appeared.

### Keep the form from feeling too long
- Use one follow-up section container with dynamically inserted groups.
- Show only the groups relevant to the current answers.
- Preserve prior answers if a user temporarily changes a trigger and then switches it back.

## F. Edge cases

### No follow-up triggered
- Show only the base questionnaire.
- Submission should still work normally.

### Multiple follow-up groups triggered
- Multiple groups may appear together.
- Layout should remain stable and readable.

### Optional answers omitted
- Submission should still work if some follow-up answers are left unanswered.
- Only include answered follow-up values.

### Backward compatibility with older payload handling
- Backend still accepts the older array-only `symptoms` shape.
- Existing ML and chat flows must continue working if follow-up data is absent.

## G. Mobile checklist

- [ ] Reuse the same base questionnaire fields from web.
- [ ] Implement conditional follow-up groups using a central rules helper.
- [ ] Reveal follow-up questions progressively instead of rendering all of them up front.
- [ ] Submit `symptoms` as structured JSON with `selected`, `followUps`, and `additionalNotes` when available.
- [ ] Keep array-only symptom payload compatibility for older flows if needed.
- [ ] Preserve existing AI-first case creation and image upload behavior.
- [ ] Handle no-trigger, single-trigger, and multi-trigger scenarios cleanly.
- [ ] Verify submission still works when follow-up answers are absent.

## H. Files changed in web

- `public/patient-case-create.html`
- `public/js/patient/case-create.js`
- `public/js/patient/case-ml.js`
- `public/js/patient/questionnaire-config.js`
- `src/modules/cases/cases.schemas.js`
- `src/modules/cases/cases.service.js`
- `src/modules/chat/chat.service.js`
- `docs/mobile-dynamic-questionnaire-task.md`
