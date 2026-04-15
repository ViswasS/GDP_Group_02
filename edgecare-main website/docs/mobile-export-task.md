# Mobile Export Task

## A. Feature overview

### What export flows were added in web
- Patients can now export the currently open case report from patient case detail.
- Patients can export filtered case history from the patient history page.
- Supported v1 history filters:
  - month-wise export
  - doctor-reviewed-only export
- Export uses a printable browser report designed for `Print / Save as PDF`.

### Why they matter
- This gives patients a practical first export flow without building a full reporting engine.
- It supports common real-world use cases:
  - sharing a single case report
  - exporting reports for a specific month
  - exporting only doctor-reviewed reports

## B. Export types supported

### Current case report export
- Available on patient case detail.
- Exports the structured health report for the currently open case.

### Month-wise export
- Available on patient case history.
- Filters cases by selected `YYYY-MM` month before export.

### Doctor-reviewed-only export
- Available on patient case history.
- Filters to cases with doctor review content before export.
- Web uses the current doctor review fields first, with a fallback to legacy doctor recommendation data when present.

## C. Data contract to reuse

### Which fields are exported
- Case overview:
  - `id`
  - `submittedAt`
  - `status`
  - `assignedDoctorId`
  - `assignedDoctor`
- AI summary:
  - `mlFusedResult.ai_summary_text`
  - `mlFusedResult.display.image_assessment`
  - `mlFusedResult.display.condition_text`
  - `mlFusedResult.display.severity_text`
  - `mlFusedResult.display.triage_text`
  - `mlFusedResult.display.next_step_text`
  - `mlFusedResult.recommended_actions`
- Emergency guidance:
  - `mlFusedResult.display.emergency_support`
- Doctor review:
  - `doctorNotes`
  - `doctorRecommendation`
  - `doctorSeverityOverride`
  - `doctorFollowUpNeeded`
  - `doctorReviewedAt`
  - fallback: `result.recommendation`
  - fallback: `result.generatedAt`
- Latest image reference:
  - `images[].uploadedAt`
  - `images[].imageUrl`
  - fallback: `imageUrls`

### Helpers / builders mobile should mirror
- Web added a shared export utility:
  - `public/js/patient/report-utils.js`
- Main reusable helpers:
  - `buildHealthReport(caseData, options)`
  - `filterHistoryCases(cases, filters)`
  - `exportCurrentCaseReport(caseData, options)`
  - `exportHistoryReports(cases, options)`
- Mobile should mirror the shaping/filtering logic, even if it uses native PDF/share tooling instead of a print window.

## D. Mobile UI requirements

### Patient case detail export placement
- Add an export action near the structured report header on patient case detail.
- Keep it clearly associated with the report, not with chat actions.

### Mobile history export controls
- Add export filters near the top of patient case history.
- Recommended controls:
  - month selector
  - doctor-reviewed-only toggle
  - export button
  - optional clear/reset action

### Smaller-screen guidance
- Keep filters stacked vertically.
- Keep the export action visible without competing with the `New Case` action.

## E. Backend / API dependencies

### Endpoints / payloads needed
- `GET /api/v1/cases/:id`
  - required for current case export
- `GET /api/v1/cases`
  - required for history export source and filtering

### Backend note
- No new export endpoint was added in web.
- v1 export is client-side and reuses current payloads plus the structured report helper.

## F. Edge cases

### No doctor review
- Current case export should still work.
- Doctor review section should render a clean empty state.

### Urgent case
- Export must include emergency guidance if present.
- Do not omit emergency contacts or urgent recommendation text.

### Empty month filter result
- Do not generate a blank export.
- Show a clean empty-state message instead.

### Historical case with partial legacy data
- If new structured doctor review fields are missing but legacy recommendation data exists, mobile may still surface that in the doctor review section, matching the web fallback behavior.

## G. Mobile checklist

- [ ] Add export action to patient case detail report header.
- [ ] Mirror `buildHealthReport(caseData)` in mobile report/export shaping.
- [ ] Add history export filters for month and doctor-reviewed-only.
- [ ] Mirror `filterHistoryCases(cases, filters)` behavior.
- [ ] Export current case report as a mobile-friendly PDF/shareable document.
- [ ] Export filtered history only when matching cases exist.
- [ ] Show clean empty-state feedback for empty filter results.
- [ ] Ensure urgent cases include emergency guidance in exported output.
- [ ] Support legacy doctor recommendation fallback for historical cases.

## H. Files changed in web

- `public/js/patient/report-utils.js`
- `public/js/patient/case.js`
- `public/js/patient/cases.js`
- `public/patient-case.html`
- `public/patient-cases.html`
- `public/css/main.css`
- `docs/mobile-export-task.md`
