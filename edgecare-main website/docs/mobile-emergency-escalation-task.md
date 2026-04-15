# Mobile Emergency Escalation Task

## A. Feature overview

### What was built in web
- The web patient case flow now surfaces an emergency escalation state whenever the normalized AI triage result indicates an urgent or high-risk case.
- Patient case detail shows a dedicated emergency support card with urgent guidance and visible emergency contact numbers.
- The patient chat autosummary flow now includes one deduped urgent AI support message with emergency guidance and contact numbers.
- Doctor-facing case list and case detail views now flag urgent cases prominently near the top of the workflow.

### Why it matters
- The product requirement is: immediate access to emergency contact numbers whenever the AI engine detects critical or high-risk symptoms.
- The web implementation closes that requirement without adding a new schema or a separate urgency engine.
- Mobile should reuse the same normalized backend signal so urgent cases behave consistently across platforms.

## B. Business logic to reuse

### Exact urgency source used
- Primary source:
  - `mlFusedResult.recommended_actions.care_level`
  - normalized in backend via `mapTriageToCareLevel()`
- Supporting signals:
  - `mlFusedResult.display.show_urgent_badge`
  - `mlFusedResult.recommended_actions.urgent_warning`
  - `mlFusedResult.red_flags` or `mlFusedResult.triage.red_flags`
- Web now emits a reusable frontend-safe contract at:
  - `mlFusedResult.display.emergency_support`

### Conditions for showing emergency UI
- Show emergency UI when any of these are true:
  - `mlFusedResult.display.emergency_support.is_emergency === true`
  - fallback: `mlFusedResult.display.show_urgent_badge === true`
  - fallback: normalized `care_level === "urgent_attention"`
- Do not show emergency UI for non-urgent or self-care cases.

### Chat / system message behavior
- Reuse the existing visible `AI_SUPPORT` autosummary message flow.
- For urgent cases, backend now generates one urgent `AI_SUPPORT` message after completed analysis.
- That message is deduped by summary key, so mobile must not try to add another client-side emergency message on top.
- Hidden `AI_SUMMARY` and `AI_GUIDANCE` records still exist for internal rendering/support context and should not be duplicated into visible mobile chat UI unless mobile intentionally mirrors the web hidden-message behavior.

### Emergency contact defaults used
- Default numbers currently used:
  - `Emergency: 112`
  - `Ambulance: 108`
- These are emitted in `mlFusedResult.display.emergency_support.contacts`.
- Mobile should render the backend-provided contacts first and only fall back to `112` / `108` if the new contract is absent on older cases.

## C. Mobile UI requirements

### Patient case detail
- Show the emergency banner/card near the top of the patient case detail screen.
- Recommended order for patient mobile case detail:
  1. Emergency support card, when urgent
  2. Case overview
  3. AI summary
  4. Doctor review status
  5. Latest upload
  6. Chat entry point / chat thread
- The emergency card should include:
  - heading such as `Seek immediate medical attention`
  - short guidance text from backend contract
  - visible contact CTAs
  - a persistent urgent label, such as `Urgent care recommended`

### Patient CTA / buttons
- Show at minimum:
  - `Call Emergency` using the provided emergency number
  - `Call Ambulance` using the provided ambulance number
  - a non-call action or helper label such as `Seek urgent care now`
- CTA style should be distinct from normal AI support or doctor review actions.
- Keep `Re-upload image` and `Request doctor review` available, but do not visually compete with emergency CTAs when urgent state is active.

### Patient chat behavior
- If the case is urgent, the visible chat should show the backend-generated urgent `AI_SUPPORT` message once.
- Do not generate a second local urgent banner inside each chat refresh.
- If mobile has a chat header/subtitle, it should reinforce the urgent guidance with concise helper text.

### Doctor-side mobile views
- In doctor case list, show a clear urgent badge on urgent cases.
- In doctor case detail, show an urgent banner near the top of the screen and near the AI summary section.
- Do not use alarm-heavy styling; match the current EdgeCare warning/danger language.

## D. API / backend dependencies

### Endpoints to reuse
- `GET /api/v1/cases/:id`
  - use this as the source for patient and doctor urgent rendering
- `GET /api/v1/cases`
  - use this for doctor list urgent badges and any patient case list indicators
- `GET /api/v1/cases/:caseId/chat/messages`
  - use this to read the visible urgent `AI_SUPPORT` message
- `POST /api/v1/cases/:caseId/chat/messages`
  - existing patient/doctor messaging flow
- `POST /api/v1/cases/:caseId/chat/ai`
  - existing AI support reply flow
- `POST /api/v1/cases/:id/reupload-image`
  - existing image replacement flow; urgent contract refreshes after new ML completion
- `POST /api/v1/cases/:id/request-doctor`
  - existing patient-triggered doctor review flow

### New payload fields introduced by the web pass
- New backend-normalized field:
  - `mlFusedResult.display.emergency_support`
- Current structure:
```json
{
  "is_emergency": true,
  "label": "Urgent care recommended",
  "heading": "Seek immediate medical attention",
  "guidance_text": "This screening suggests the case may need immediate medical evaluation. Contact emergency services or go to the nearest hospital now if symptoms are severe or worsening.",
  "warning_text": "Urgent symptoms may need prompt in-person medical evaluation.",
  "chat_text": "Your case may need urgent medical attention. Please contact emergency services or go to the nearest hospital immediately if symptoms are severe or worsening.",
  "next_step_text": "Seek urgent medical attention now. Contact emergency services or go to the nearest hospital if symptoms are severe or worsening.",
  "contacts": [
    { "label": "Emergency", "number": "112", "description": "National emergency helpline", "href": "tel:112" },
    { "label": "Ambulance", "number": "108", "description": "Ambulance support", "href": "tel:108" }
  ]
}
```

### Response normalization mobile must mirror
- Prefer `mlFusedResult.display.emergency_support`.
- Fallback rules for historical cases:
  - use `mlFusedResult.display.show_urgent_badge`
  - or `mlFusedResult.recommended_actions.care_level === "urgent_attention"`
  - or `mlFusedResult.recommended_actions.urgent_warning`
- Do not create a separate mobile-only urgency model.

## E. Edge cases

### Non-urgent case
- No emergency banner
- No emergency CTAs
- Normal AI summary and normal AI chat behavior

### Urgent case
- Show emergency banner/card on patient case detail
- Show emergency numbers
- Show one urgent `AI_SUPPORT` chat message from backend
- Show urgent badge/banner in doctor mobile views
- Ensure recommendation / next-step copy does not say home care or simple monitoring

### Historical urgent case
- Older cases may not yet contain `display.emergency_support`
- Mobile must still render urgent UI from fallback fields:
  - `display.show_urgent_badge`
  - `recommended_actions.care_level`
  - `recommended_actions.urgent_warning`

### Dedupe behavior for emergency chat / support message
- Backend dedupes the visible urgent `AI_SUPPORT` autosummary by summary key.
- Mobile should render whatever arrives from chat messages and should not inject another local urgent message.
- Reopening or refreshing the case must not create duplicate urgent support messages.
- A new image analysis run may legitimately create a new urgent `AI_SUPPORT` message if the image/state changed.

## F. Implementation checklist for mobile

- [ ] Read `mlFusedResult.display.emergency_support` from case detail payload.
- [ ] Add fallback urgency detection for historical cases using `show_urgent_badge` and normalized `care_level`.
- [ ] Add patient emergency support card to mobile patient case detail near the top of the screen.
- [ ] Wire emergency CTAs to `tel:` links using backend-provided numbers.
- [ ] Keep `Re-upload image` and `Request doctor review` visible but visually secondary to emergency CTAs when urgent.
- [ ] Ensure patient chat renders backend urgent `AI_SUPPORT` messages without creating duplicate local messages.
- [ ] Add urgent helper text to the mobile patient chat header or case header if that surface exists.
- [ ] Add urgent badge treatment to doctor mobile case list.
- [ ] Add urgent banner treatment to doctor mobile case detail near the top of the case.
- [ ] Verify non-urgent cases show no emergency UI.
- [ ] Verify urgent cases show emergency UI consistently after initial analysis and after image re-upload.
- [ ] Verify historical urgent cases still render urgent UI from fallback fields.
- [ ] Verify refresh/reopen does not duplicate emergency support messages.

## G. Files changed in web

Use these as the implementation reference for the mobile pass:
- Backend logic:
  - `src/modules/cases/cases.service.js`
- Patient web UI:
  - `public/js/patient/case.js`
  - `public/css/main.css`
- Doctor web UI:
  - `public/js/doctor/dashboard.js`
  - `public/js/doctor/case.js`

## Notes for the mobile pass
- No Prisma migration was added for this feature.
- No new endpoint was introduced specifically for emergency escalation; the new contract is embedded into the existing case detail/list payload through `mlFusedResult.display.emergency_support`.
- If mobile has an offline cache layer, cache the emergency contract with the case detail payload so historical urgent cases remain visibly urgent when reopened.
