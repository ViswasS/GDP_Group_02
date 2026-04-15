# Cases API Contract (EdgeCare-Triage backend)

## Auth requirements
- All endpoints require `Authorization: Bearer <JWT>` parsed by `requireAuth` (`src/common/middleware/auth.js`); payload must carry `sub` (user id), `role`, `email`. Missing/invalid token → `401 { success:false, message: "...token" }`.
- Role gating via `requireRole` (`src/common/middleware/rbac.js`) or service-level checks:
  - PATIENT: create case; list own cases; view own case; limited patch.
  - DOCTOR: list assigned cases; view assigned case; update status only; upsert triage result (only if assigned).
  - ADMIN: list all cases; view any case; update any case; assign doctor; delete case; admin queue.

## Endpoints table
| Method | Path (prefixed with `/api/v1`) | Purpose | Roles |
| --- | --- | --- | --- |
| POST | /cases | Create a new case intake | PATIENT |
| GET | /cases | List cases for current user | PATIENT / DOCTOR / ADMIN |
| GET | /cases/:id | Get single case details | PATIENT (owner) / DOCTOR (assigned) / ADMIN |
| PATCH | /cases/:id | Update case fields / status | PATIENT (own, limited) / DOCTOR (assigned status) / ADMIN |
| PUT | /cases/:id/assign-doctor | Assign a doctor + set `IN_REVIEW` | ADMIN |
| DELETE | /cases/:id | Delete case + intake | ADMIN |
| PUT | /triage/cases/:caseId/result | Upsert triage result for a case | DOCTOR (assigned) / ADMIN |
| GET | /admin/cases | Admin case queue (filters, paging) | ADMIN |

## Detailed endpoint specs

### Create Case — POST `/api/v1/cases`
- Auth/Role: Bearer JWT, PATIENT only; service ensures patient profile exists.
- Body schema (`createCaseSchema`, `cases.schemas.js`):
  - `title` string, min 3 (required)
  - `duration` string (optional)
  - `medications` string (optional)
  - `isEmergency` boolean (optional, default false)
  - `description` string (optional; **note: not persisted to DB as of service implementation**)
- Response `201`:
```json
{
  "success": true,
  "message": "Case created",
  "data": {
    "id": 12,
    "patientId": 5,
    "intakeId": 33,
    "isEmergency": false,
    "assignedDoctorId": null,
    "status": "SUBMITTED",
    "submittedAt": "2026-02-16T08:42:00.000Z",
    "intake": { "id": 33, "title": "Headache", "isActive": true, "duration": "3 days", "medications": "Ibuprofen" },
    "patient": { "patientId": 5 }
  }
}
```
- Error cases:
  - 401 missing/invalid token.
  - 403 if user lacks patient profile.
  - 400 validation errors (see common format below).

### List Cases — GET `/api/v1/cases`
- Auth/Role: Bearer; PATIENT returns own cases; DOCTOR returns assigned cases; ADMIN returns all.
- Query: none.
- Response `200`: array of triage cases ordered by `submittedAt desc`.
  - Common fields: `id, patientId, intakeId, isEmergency, assignedDoctorId, status, submittedAt`.
  - `intake`: `{ id, title, isActive, duration, medications }`.
  - `result`: `{ id, caseId, recommendation, confidenceScore, generatedAt, modelId }` (decimal returns as stringified number).
  - DOCTOR results include `patient` profile; ADMIN results include `patient` + `assignedDoctor`.

### Get Case Details — GET `/api/v1/cases/:id`
- Path param validated as numeric string (`caseIdParamSchema`).
- Auth/Role: PATIENT owner; DOCTOR assigned; ADMIN any; 403 otherwise.
- Response `200` data includes:
  - Base fields as above plus relations:
  - `intake`, `result`, `images`, `patient`, `assignedDoctor`, `reviews`.
  - `images` entries: `{ id, caseId, questionFlags, imageBlob, imageUrl, mimeType, fileSize, sha256, uploadedAt }`.
  - `reviews` entries: `{ id, caseId, doctorId, actionNotes, reviewTimestamp }`.
  - `patient` / `assignedDoctor` are profile records (no nested user by default).

### Update Case — PATCH `/api/v1/cases/:id`
- Path param: numeric string.
- Body schema (`updateCaseSchema`):
  - Optional fields; at least one required (refine rule).
  - Strings: `title` (min 3), `duration`, `medications`, `description`.
  - `isEmergency` boolean.
  - `status` enum `SUBMITTED | IN_REVIEW | CLOSED`.
  - `duration` / `medications` accept `null` to clear (coerced via service).
- Role rules (service-level):
  - ADMIN: may edit all listed fields.
  - PATIENT (owner only): `title,duration,medications,description,isEmergency`.
  - DOCTOR (assigned only): `status` only.
  - Any other field from disallowed role → 403 Forbidden.
- Response `200`: `{ success:true, data:<case>, message:"Case updated" }` with `intake,result,patient,assignedDoctor` included.
- Notable behavior: `status` change by DOCTOR/ADMIN; PATIENT cannot set status.

### Assign Doctor — PUT `/api/v1/cases/:id/assign-doctor`
- Auth/Role: ADMIN only.
- Body (`assignDoctorSchema`):
  - `doctorId` number, int, positive (required).
- Effect: sets `assignedDoctorId` to doctor, and forces `status` to `IN_REVIEW`.
- Response `200`:
```json
{ "success": true, "message": "Doctor assigned", "data": { ...case with intake, patient, assignedDoctor } }
```

### Delete Case — DELETE `/api/v1/cases/:id`
- Auth/Role: ADMIN only (route) — service also blocks DOCTOR and non-owners.
- Effect: Deletes `TriageCase` and linked `CaseIntake` in a transaction.
- Response `200`: `{ "success": true, "message": "Case deleted" }`.

### Upsert Triage Result — PUT `/api/v1/triage/cases/:caseId/result`
- Auth/Role: Bearer; DOCTOR (must be assigned) or ADMIN; service enforces role + assignment.
- Params: `caseId` numeric string.
- Body (`upsertResultSchema`):
  - `recommendation` string min 5 (required).
  - `confidenceScore` number 0..1 (optional).
  - `modelName` string (optional) + `modelVersion` string (optional); if both present, AI model is upserted and linked.
- Response `200`: `{ success:true, message:"Triage result saved", data:{ id, caseId, recommendation, confidenceScore, generatedAt, modelId } }`.
- Errors: 403 if doctor not assigned; 404 if case missing.

### Admin Case Queue — GET `/api/v1/admin/cases`
- Auth/Role: ADMIN only.
- Query (`adminCaseQueueSchema`):
  - `status` enum `SUBMITTED|IN_REVIEW|CLOSED` (optional).
  - `unassigned` boolean via string `"true"|"1"` (optional).
  - `page` integer >=1 (default 1).
  - `pageSize` integer 1..100 (default 20).
- Response `200`:
```json
{
  "success": true,
  "data": {
    "page": 1,
    "pageSize": 20,
    "total": 42,
    "items": [ { case with intake, patient{language,consentStatus,user{email}}, assignedDoctor{specialty,licenseNumber,user{email}}, result } ]
  }
}
```

## Common error format
- All errors pass through `errorHandler` (`src/common/errors/errorHandler.js`):
```json
{ "success": false, "message": "Validation error", "details": { "fieldErrors": { "body": { "title": ["String must contain at least 3 character(s)"] } } } }
```
- Status codes used: 400 (Zod validation), 401 (missing/invalid token), 403 (role/ownership), 404 (case/doctor not found), 500 (unhandled). Stack trace only in non-production env.

## Enums and constants
- Case status: `SUBMITTED`, `IN_REVIEW`, `CLOSED` (`prisma/schema.prisma` + `updateCaseSchema`).
- Roles: `ADMIN`, `DOCTOR`, `PATIENT`.
- Timestamps (`submittedAt`, `generatedAt`, `uploadedAt`, etc.) are ISO-8601 strings from Prisma `DateTime`.
- `confidenceScore` stored as Decimal(5,4); JSON renders as stringified number.
- Case images exist in DB schema (`CaseImage`) but **no upload/list routes are implemented**; attachments/chat linkage not found.

## cURL examples
- Create case (PATIENT):
```bash
curl -X POST https://edgecare.onrender.com/api/v1/cases \
  -H "Authorization: Bearer <patient_jwt>" \
  -H "Content-Type: application/json" \
  -d '{ "title": "Headache", "duration": "3 days", "medications": "Ibuprofen", "isEmergency": false }'
```
- List cases:
```bash
curl -H "Authorization: Bearer <patient_or_doctor_or_admin_jwt>" https://edgecare.onrender.com/api/v1/cases
```
- Get case by id:
```bash
curl -H "Authorization: Bearer <jwt>" https://edgecare.onrender.com/api/v1/cases/12
```
- Update case (PATIENT fields):
```bash
curl -X PATCH https://edgecare.onrender.com/api/v1/cases/12 \
  -H "Authorization: Bearer <patient_jwt>" -H "Content-Type: application/json" \
  -d '{ "medications": null, "duration": "1 week" }'
```
- Update status (DOCTOR assigned):
```bash
curl -X PATCH https://edgecare.onrender.com/api/v1/cases/12 \
  -H "Authorization: Bearer <doctor_jwt>" -H "Content-Type: application/json" \
  -d '{ "status": "IN_REVIEW" }'
```
- Assign doctor (ADMIN):
```bash
curl -X PUT https://edgecare.onrender.com/api/v1/cases/12/assign-doctor \
  -H "Authorization: Bearer <admin_jwt>" -H "Content-Type: application/json" \
  -d '{ "doctorId": 7 }'
```
- Delete case (ADMIN):
```bash
curl -X DELETE -H "Authorization: Bearer <admin_jwt>" https://edgecare.onrender.com/api/v1/cases/12
```
- Upsert triage result (DOCTOR assigned or ADMIN):
```bash
curl -X PUT https://edgecare.onrender.com/api/v1/triage/cases/12/result \
  -H "Authorization: Bearer <doctor_jwt>" -H "Content-Type: application/json" \
  -d '{ "recommendation": "Prescribe rest and hydration", "confidenceScore": 0.82, "modelName": "gpt-health", "modelVersion": "1.0" }'
```
- Admin case queue with filters:
```bash
curl -H "Authorization: Bearer <admin_jwt>" \
  "https://edgecare.onrender.com/api/v1/admin/cases?status=SUBMITTED&unassigned=true&page=1&pageSize=20"
```
