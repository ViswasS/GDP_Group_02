# Mobile Web Polish Task

## A. Summary of web polish/stabilization changes
- Unified patient, doctor, and admin wording around core case states, AI support, review, export, and image re-upload actions.
- Cleaned navigation by removing redundant doctor detail back navigation, fixing admin active-nav styling, and removing duplicate doctor profile nav links.
- Standardized shared card, badge, button, focus, empty-state, and responsive behavior in the shared CSS layer.
- Improved patient, doctor, and admin data presentation so visible names and statuses are friendlier and less email- or enum-heavy.
- Polished report/export text and print wrapping so long recommendations, notes, and emergency guidance present cleanly in demo flows.

## B. Cross-role UI consistency decisions
- `SUBMITTED` is presented as `AI Support Active`.
- `IN_REVIEW` is presented as `In Review`.
- `CLOSED` is presented as `Closed`.
- Urgent state uses the same red emergency badge treatment across patient, doctor, and admin surfaces.
- AI summary / AI-first state uses the same blue-green support language instead of mixed labels like `AI review`, `AI generated`, or `AI-first only`.
- Primary actions use the same filled button treatment; secondary actions stay outlined; destructive/emergency messaging stays visually separate.
- Empty and error states use shared card-like messaging blocks instead of bare text lines.

## C. Wording/status conventions to mirror in mobile
- `Request doctor review`
- `Re-upload image`
- `Export report`
- `AI Support Active`
- `In Review`
- `Closed`
- `Urgent`
- `Doctor-reviewed severity`
- `Doctor review advised`
- `Emergency guidance active`

## D. Responsive/layout lessons relevant to mobile app
- Long status badges and action bars need wrap-safe layouts; avoid single-row assumptions for action clusters.
- Chat compose areas should allow the send button to drop below the textarea cleanly on narrow widths.
- List rows should degrade from three-column layouts into stacked action regions without losing primary context.
- Shared empty/error/loading states improve perceived stability when case data, AI data, or admin insights are delayed.
- User-facing report sections need aggressive text wrapping for long notes, recommendations, and emergency instructions.

## E. Remaining mobile-specific polish opportunities
- Convert long report sections into collapsible mobile cards to shorten scroll depth.
- Add mobile-first sticky case actions for `Request doctor review`, `Re-upload image`, and `Export report`.
- Mirror the new web empty/error patterns inside native loading skeletons and offline states.
- Review chat bubble width, timestamp density, and safe-area spacing against small-screen devices.
- Validate emergency guidance prominence against mobile notification/toast patterns.

## F. Files changed in web
- `admin/ai-console.html`
- `admin/dashboard.html`
- `admin/insights.html`
- `admin/js/ai-console.js`
- `admin/js/case-queue.js`
- `admin/js/dashboard.js`
- `public/css/chat.css`
- `public/css/components.css`
- `public/css/main.css`
- `public/doctor-case.html`
- `public/doctor-dashboard.html`
- `public/doctor-profile.html`
- `public/js/doctor/case.js`
- `public/js/doctor/chat.js`
- `public/js/doctor/dashboard.js`
- `public/js/doctor/profile.js`
- `public/js/patient/case-create.js`
- `public/js/patient/case.js`
- `public/js/patient/cases.js`
- `public/js/patient/dashboard.js`
- `public/js/patient/profile.js`
- `public/js/patient/report-utils.js`
- `public/patient-case-create.html`
- `public/patient-case.html`
- `public/patient-cases.html`
- `public/patient-dashboard.html`
- `public/patient-profile.html`

## G. Checklist for mobile design/system alignment
- Mirror the same status vocabulary and badge colors.
- Prefer names over raw emails in top bars and case headers when a profile name exists.
- Keep `Urgent` visually dominant and never duplicate it with conflicting labels.
- Match primary, secondary, and loading button behavior to web.
- Ensure export/report labels match the web report exactly.
- Use friendly environmental context labels instead of raw enum keys.
- Keep doctor and patient review terminology aligned with web copy.
- Reuse the shared empty/loading/error tone: short, calm, action-oriented.
