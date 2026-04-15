# Mobile Health Report Task

## A. Feature overview

### What was built in web
- The patient case page now shows a structured health report that combines:
  - case overview
  - normalized AI triage summary
  - emergency guidance when applicable
  - doctor review details
  - latest uploaded image reference
- The report is rendered from the existing case payload and current normalized ML display fields.
- The report keeps AI analysis and doctor review clearly separated so patients can understand what came from AI versus what came from a doctor.

### Why it matters
- This closes the requirement to display structured triage reports that summarize AI analysis, doctor comments, and recommendations.
- Mobile should reuse the same payload fields and the same section order so patients get a consistent report across platforms.

## B. Data contract to reuse

### Exact fields used from the current payload
- Case overview:
  - `id`
  - `submittedAt`
  - `status`
  - `assignedDoctorId`
  - `assignedDoctor.firstName`
  - `assignedDoctor.lastName`
  - `assignedDoctor.user.email`
  - `patient.firstName`
  - `patient.lastName`
  - `patient.user.email`
- AI triage summary:
  - `mlFusedResult.ai_summary_text`
  - `mlFusedResult.display.image_assessment`
  - `mlFusedResult.display.condition_text`
  - `mlFusedResult.display.severity_text`
  - `mlFusedResult.display.triage_text`
  - `mlFusedResult.display.next_step_text`
  - `mlFusedResult.recommended_actions.items`
  - `mlFusedResult.recommended_actions.care_level`
  - `mlFusedResult.image_gate.quality.quality_status`
  - `mlImageResult.quality`
- Emergency guidance:
  - `mlFusedResult.display.emergency_support`
  - fallback: `mlFusedResult.display.show_urgent_badge`
  - fallback: `mlFusedResult.recommended_actions.care_level`
- Doctor review:
  - `doctorNotes`
  - `doctorRecommendation`
  - `doctorSeverityOverride`
  - `doctorFollowUpNeeded`
  - `doctorReviewedAt`
  - fallback legacy recommendation: `result.recommendation`
  - fallback legacy timestamp: `result.generatedAt`
- Latest uploaded image:
  - `images[].uploadedAt`
  - `images[].imageUrl`
  - fallback: `imageUrls`

### Helper / normalization added in web
- Web added a frontend shaping helper in `public/js/patient/case.js`:
  - `buildHealthReport(caseData)`
- That helper derives a patient-friendly report object from the existing case payload.
- Mobile should implement the equivalent shaping layer locally instead of reconstructing section content ad hoc inside multiple screens.

## C. Mobile UI requirements

### Placement in patient case flow
- Show the structured report inside patient case detail as a primary read-only summary block above or before chat-heavy content.
- Recommended mobile section order:
  1. Emergency guidance, if urgent
  2. Case overview
  3. AI triage summary
  4. Doctor review
  5. Latest uploaded image reference

### Smaller-screen arrangement
- Render sections as stacked cards or stacked subsections inside one report container.
- Keep labels concise and readable.
- Avoid horizontal compression of report grids; prefer one-column layout on smaller screens.

### Doctor review and emergency guidance
- Keep AI and doctor content visually distinct.
- If `doctorSeverityOverride` exists, label it as `Doctor-reviewed severity`.
- If urgent guidance exists, show it as its own report section and keep it above or before the rest of the report.
- Continue to show the dedicated emergency banner if the mobile app already has one; the report section does not replace that urgent surface.

## D. API / backend dependencies

### Endpoints / payloads mobile must reuse
- `GET /api/v1/cases/:id`
  - primary source for patient report rendering
- `GET /api/v1/cases`
  - optional list-level report indicators if mobile wants preview cards

### Backend fields mobile must reuse
- `mlFusedResult.display`
- `mlFusedResult.recommended_actions`
- `mlFusedResult.ai_summary_text`
- `doctorNotes`
- `doctorRecommendation`
- `doctorSeverityOverride`
- `doctorFollowUpNeeded`
- `doctorReviewedAt`
- `assignedDoctor`
- `result.recommendation`
- `result.generatedAt`

## E. Edge cases

### No doctor review yet
- Show the doctor review section in a clean empty state:
  - `No doctor review has been added yet.`
- If a doctor is assigned but has not saved formal review fields yet, keep the copy neutral.

### Urgent case
- Show the emergency guidance section in the report.
- Do not show contradictory home-care wording for the next step.
- Use normalized emergency support data first.

### Doctor-reviewed severity differs from AI severity
- Keep both visible:
  - AI section shows `AI severity`
  - Doctor section shows `Doctor-reviewed severity`
- Do not merge them into one severity line.

### Historical case opened later
- Continue rendering from the saved normalized `mlFusedResult.display` contract.
- If structured doctor review fields are missing but legacy `result.recommendation` exists, mobile may surface that as fallback recommendation in the doctor section, matching the web behavior.

## F. Mobile checklist

- [ ] Read the full case payload from `GET /api/v1/cases/:id`.
- [ ] Add a report shaping helper equivalent to `buildHealthReport(caseData)`.
- [ ] Render patient-friendly report sections in the mobile patient case detail flow.
- [ ] Keep AI triage summary and doctor review clearly separated.
- [ ] Show emergency guidance section only when urgent support is active.
- [ ] Render `Doctor-reviewed severity` explicitly when `doctorSeverityOverride` is present.
- [ ] Support empty-state copy when no doctor review exists yet.
- [ ] Use a one-column stacked section layout on smaller screens.
- [ ] Reuse backend-provided normalized display fields instead of recreating triage logic.
- [ ] Verify historical cases still render correctly from saved normalized payloads.

## G. Files changed in web

- `public/js/patient/case.js`
- `public/css/main.css`
- `docs/mobile-health-report-task.md`

### Matching related web logic
- `src/modules/cases/cases.service.js`
- `public/patient-case.html`
