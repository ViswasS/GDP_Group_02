# Mobile Admin Insights Task

## A. Feature Overview

Web now includes a proper admin insights dashboard for EdgeCare. The admin landing page surfaces operational metrics across patients, doctors, cases, urgent demand, AI-first case flow, doctor workload, recent cases, and AI/triage workflow signals.

This matters because admins can now understand platform health and case movement at a glance instead of only seeing a raw assignment queue.

## B. Metrics / Data Contract Returned By Backend

Mobile should reuse:

- `GET /api/v1/admin/insights/dashboard`

Returned shape:

```json
{
  "summary": {
    "totalPatients": 0,
    "totalDoctors": 0,
    "totalCases": 0,
    "submittedCases": 0,
    "openCases": 0,
    "inReviewCases": 0,
    "closedCases": 0,
    "urgentCases": 0,
    "aiFirstCases": 0
  },
  "statusBreakdown": [
    {
      "key": "SUBMITTED",
      "label": "Submitted / AI-first",
      "count": 0,
      "percentage": 0
    }
  ],
  "workflow": {
    "aiFirstUnassignedCases": 0,
    "doctorAssignedCases": 0,
    "doctorReviewedCases": 0,
    "doctorReviewRequestedCases": 0,
    "reuploadedImageCases": 0
  },
  "triageInsights": {
    "clearNonRashCases": 0,
    "uncertainCases": 0,
    "doctorReviewRequestedCases": 0,
    "reuploadedImageCases": 0,
    "urgentCases": 0,
    "mlCompletedCases": 0
  },
  "doctorWorkload": [
    {
      "doctorId": 1,
      "doctorName": "Dr. Example",
      "specialty": "Dermatology",
      "experience": 8,
      "assignedCases": 0,
      "activeAssignedCases": 0,
      "urgentAssignedCases": 0,
      "reviewedCases": 0,
      "closedCases": 0
    }
  ],
  "recentCases": [
    {
      "id": 12,
      "title": "Rash on arm",
      "patientName": "Jane Doe",
      "status": "SUBMITTED",
      "statusLabel": "Submitted / AI-first",
      "urgent": false,
      "assignedDoctorName": "Unassigned",
      "submittedAt": "2026-03-30T08:00:00.000Z",
      "careLevel": "Routine review",
      "aiFirst": true
    }
  ],
  "queuePreview": []
}
```

### Existing supporting endpoints still available

- `GET /api/v1/admin/cases?unassigned=true`
- `GET /api/v1/users?role=DOCTOR`

## C. Suggested Mobile Admin Layout

Recommended mobile layout:

1. Hero / top summary
   - admin title
   - refresh action
   - quick link to case queue
2. KPI cards carousel or 2-column grid
   - total patients
   - total doctors
   - total cases
   - open cases
   - in review
   - closed cases
   - urgent cases
   - AI-first cases
3. Case status breakdown
   - stacked bars or progress rows
4. AI / triage insights
   - small metric cards
5. Doctor workload list
   - doctor name
   - active assigned
   - urgent assigned
   - reviewed
   - closed
6. Recent cases list
   - title
   - patient
   - status
   - urgent badge
   - assigned doctor
   - submitted date
7. Queue preview
   - latest AI-first unassigned cases

## D. Edge Cases And Empty States

- No doctors yet
  - show empty doctor workload state
- No cases yet
  - show empty KPI-safe values and empty recent case list
- No urgent cases
  - urgent KPI should be `0`, not hidden
- No AI-first queue
  - queue preview should show a clean empty state
- Partial ML data / old cases
  - backend already derives insights defensively from current saved fields
  - mobile should not assume every case has normalized ML display fields

## E. Checklist For Mobile Implementation

- [ ] Add admin insights screen using `GET /api/v1/admin/insights/dashboard`
- [ ] Render KPI summary cards from `summary`
- [ ] Render status breakdown rows from `statusBreakdown`
- [ ] Render AI/triage insight cards from `triageInsights`
- [ ] Render doctor workload list/table from `doctorWorkload`
- [ ] Render recent cases list from `recentCases`
- [ ] Render queue preview from `queuePreview`
- [ ] Add refresh behavior
- [ ] Handle empty and zero-state screens cleanly
- [ ] Keep urgent cases visually distinct but not noisy

## F. Files Changed In Web

- `D:\\Web\\src\\modules\\admin\\admin.service.js`
- `D:\\Web\\src\\modules\\admin\\admin.controller.js`
- `D:\\Web\\src\\modules\\admin\\admin.routes.js`
- `D:\\Web\\admin\\dashboard.html`
- `D:\\Web\\admin\\js\\dashboard.js`
- `D:\\Web\\admin\\insights.html`
- `D:\\Web\\admin\\js\\case-queue.js`
- `D:\\Web\\admin\\ai-console.html`
