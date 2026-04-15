# Mobile Doctor Review Task

## Feature overview

### What was built in web
- Doctors can now submit and edit a structured review for an assigned case from the doctor portal.
- The structured review includes:
  - `doctorNotes`
  - `doctorRecommendation`
  - `doctorSeverityOverride`
  - `doctorFollowUpNeeded`
  - `doctorReviewedAt`
- Patients can see the completed doctor review in read-only form on the patient case detail screen.
- The chat flow now posts one deduped system message when a doctor review is first saved or later updated:
  - `A doctor has reviewed your case. Please check the updated recommendations.`

### Why it matters
- This closes the requirement that authorized doctors can formally edit, annotate, and update case details through the portal.
- Mobile should reuse the same review contract and not create a parallel review model.

## Fields introduced

### Case-level review fields
- Stored directly on `Triage_Case`:
  - `doctorNotes: string | null`
  - `doctorRecommendation: string | null`
  - `doctorSeverityOverride: "mild" | "moderate" | "severe" | null`
  - `doctorFollowUpNeeded: boolean | null`
  - `doctorReviewedAt: string | null`

### Notes
- These fields are the canonical “current doctor review” for the case.
- Existing ML fields are unchanged and must not be overwritten by mobile review actions.

## API contract

### Save / update doctor review
- Endpoint:
  - `POST /api/v1/cases/:id/doctor-review`
- Auth:
  - doctor only
  - service also checks that the doctor is the assigned doctor for the case
- Request body:
```json
{
  "doctorNotes": "Clinical note text",
  "doctorRecommendation": "Patient-facing next step",
  "doctorSeverityOverride": "moderate",
  "doctorFollowUpNeeded": true
}
```
- Response:
```json
{
  "success": true,
  "message": "Doctor review saved",
  "data": {
    "case": {
      "...": "existing case payload",
      "doctorNotes": "Clinical note text",
      "doctorRecommendation": "Patient-facing next step",
      "doctorSeverityOverride": "moderate",
      "doctorFollowUpNeeded": true,
      "doctorReviewedAt": "2026-03-30T12:00:00.000Z"
    },
    "systemMessage": {
      "messageType": "DOCTOR_REVIEWED",
      "content": "A doctor has reviewed your case. Please check the updated recommendations."
    }
  }
}
```

### Case detail / list payloads
- Reuse existing:
  - `GET /api/v1/cases/:id`
  - `GET /api/v1/cases`
- These now include the doctor review fields on the case object.

### Chat dependencies
- Reuse existing:
  - `GET /api/v1/cases/:caseId/chat/messages`
  - `POST /api/v1/cases/:caseId/chat/messages`
- Do not create a second mobile-only review message. Render the backend `DOCTOR_REVIEWED` system message when present.

## Mobile UI placement

### Doctor app flow
- On doctor case detail, add a `Doctor Review` card near the top of the review workspace.
- Recommended order:
  1. Case overview
  2. Doctor Review form
  3. AI summary
  4. Existing recommendation/result tools
  5. Chat

### Doctor review form
- Fields:
  - Notes textarea
  - Recommendation textarea
  - Severity override segmented control or radio group
  - Follow-up needed checkbox or switch
- Primary action:
  - `Save review`
- If review already exists:
  - preload fields
  - allow editing
  - show reviewed timestamp

### Patient app flow
- On patient case detail, show a read-only `Doctor Review` card only when review data exists.
- Display:
  - doctor name
  - notes
  - recommendation
  - severity override
  - follow-up needed
  - reviewed timestamp

## Doctor flow

1. Doctor opens assigned case.
2. Existing review values load into the form if present.
3. Doctor edits notes, recommendation, severity override, or follow-up state.
4. Doctor taps `Save review`.
5. App refreshes the case detail and chat state.
6. Patient later sees the updated review on the patient case screen.

## Patient view

- Patient cannot edit doctor review fields.
- If no doctor review exists yet:
  - keep the existing assignment-status treatment
- If review exists:
  - show the read-only doctor review card
  - keep the rest of the AI/chat/case actions intact

## Edge cases

### No review yet
- Doctor form should load empty state.
- Patient screen should not show the doctor review card yet.

### Existing review
- Doctor form should preload the saved values.
- Patient should see the read-only review card.

### Follow-up false
- Preserve explicit `false`.
- Do not treat `false` as missing data.

### Repeated edits
- Backend should not create duplicate `DOCTOR_REVIEWED` system messages on every save.
- Mobile should render the backend message stream as-is and not inject a second local message.

### Case access
- Only the assigned doctor should be allowed to save the review.
- Patients can read the review only through normal case detail access.

## Implementation checklist

- [ ] Read doctor review fields from case detail payload.
- [ ] Add doctor review form to doctor mobile case detail.
- [ ] Preload existing doctor review values when present.
- [ ] Wire `POST /api/v1/cases/:id/doctor-review`.
- [ ] Refresh case detail after save.
- [ ] Refresh chat after save so `DOCTOR_REVIEWED` message is visible if needed.
- [ ] Add read-only doctor review card to patient mobile case detail.
- [ ] Preserve existing AI, ML, assignment, and chat flows.
- [ ] Verify explicit `false` for follow-up is rendered correctly.
- [ ] Verify repeated doctor edits do not create duplicate review system messages.

## Matching web files to inspect

- Backend:
  - `src/modules/cases/cases.service.js`
  - `src/modules/cases/cases.controller.js`
  - `src/modules/cases/cases.routes.js`
  - `src/modules/cases/cases.schemas.js`
  - `prisma/schema.prisma`
  - `prisma/migrations/20260330113000_add_doctor_review_fields/migration.sql`
- Doctor web UI:
  - `public/doctor-case.html`
  - `public/js/doctor/case.js`
  - `public/css/main.css`
- Patient web UI:
  - `public/js/patient/case.js`
