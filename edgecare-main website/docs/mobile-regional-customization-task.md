# Mobile Regional / Environmental Customization Task

## A. Feature Overview

Web now includes a lightweight environmental-context layer inside the patient case creation flow. Patients can optionally select a climate/environment and exposure triggers, and the intake form uses that context to show small tailored helper text plus a few extra follow-up questions when relevant.

This improves intake quality without adding geolocation or hard-coded regional diagnosis logic. The context is stored as optional structured symptom metadata so it can also appear later in the patient health report and doctor review view.

## B. Environmental Context Fields

### Climate / environment

- `HOT_HUMID` = Hot / humid
- `DRY_LOW_HUMIDITY` = Dry / low-humidity
- `DUSTY_POLLUTION` = Dusty / pollution-heavy
- `RAINY_DAMP` = Rainy / damp
- `CHANGED_ENVIRONMENT` = Recently changed environment / traveled

### Possible trigger context / exposures

- `SWEATING_HEAT` = Sweating / heat exposure
- `NEW_SKINCARE` = New skincare / cosmetic product
- `OUTDOOR_SUN` = Outdoor exposure / sun
- `DUST_POLLUTION` = Dust / pollution exposure
- `SEASONAL_ALLERGY` = Seasonal allergy period

## C. Tailoring Logic

The mobile form should mirror the web logic:

- `HOT_HUMID` or `SWEATING_HEAT`
  - show helper text about sweat, friction, and moisture-related irritation context
  - show follow-up: `worseWithSweatOrFriction`
- `DRY_LOW_HUMIDITY`
  - show helper text about dryness, tightness, or cracking context
  - show follow-up: `drynessOrCracking`
- `DUSTY_POLLUTION` or `DUST_POLLUTION`
  - show helper text about irritation/contact/exposure context
  - show follow-up: `worseAfterDustOrOutdoorExposure`
- `RAINY_DAMP`
  - show helper text about dampness/moisture context
  - show follow-up: `worseWhenDamp`
- `CHANGED_ENVIRONMENT`
  - show helper text about recent travel/environment change context
  - show follow-up: `startedAfterTravelOrChange`

This logic is contextual guidance only. It does not change diagnosis logic or create hard regional medical rules.

## D. Data Contract

Mobile should keep using the existing case-create payload and structured `symptoms` object.

### Supported `symptoms` payload shape

```json
{
  "selected": ["Itching", "Pain"],
  "followUps": {
    "itching": {
      "severity": "Severe",
      "worseAtNight": true
    },
    "environmentHotHumid": {
      "worseWithSweatOrFriction": true
    }
  },
  "additionalNotes": "Started after travel and heat exposure.",
  "environmentContext": {
    "climate": "HOT_HUMID",
    "exposures": ["SWEATING_HEAT", "OUTDOOR_SUN"]
  }
}
```

### Backward compatibility

- Old array payloads are still valid:
  - `["Itching", "Redness"]`
- `environmentContext` is optional
- `followUps` is optional
- backend normalization already accepts missing or partial environmental context

## E. Mobile UI Requirements

### Placement in case creation

- show the environmental section after base symptom chips and before or near intensity/follow-up questions
- keep it visually compact
- use one climate selector group and one exposure multi-select group
- show helper text only when a climate/exposure selection is made

### Smaller-screen arrangement

- stack climate options into tappable pills or segmented rows
- keep exposure options as multi-select chips
- show the contextual note inline under the section
- reveal environment-driven follow-up questions progressively, not all at once

### Later visibility

On patient case detail / health report:
- show an `Environmental Context` report section when data exists
- display climate, exposures, and a short note that this is supportive context only

On doctor case detail:
- show a compact `Environmental context` summary near intake details

## F. Edge Cases

- No environment selected:
  - case creation works normally
  - no tailored helper text
  - no environmental report section later
- Multiple exposures selected:
  - save all selected exposure values in `environmentContext.exposures`
  - helper text can stay short and generic if multiple contexts overlap
- Backward compatibility with old payloads:
  - older cases may have `symptoms` as an array only
  - mobile must not assume `environmentContext` exists
- Partial answers:
  - climate may exist without exposures
  - exposures may exist without climate
  - follow-up answers may be absent even if a context group was shown

## G. Mobile Checklist

- [ ] Add environmental context section to patient case creation
- [ ] Add climate/environment single-select options matching web enum values
- [ ] Add exposure multi-select options matching web enum values
- [ ] Show contextual helper text only when climate/exposure context exists
- [ ] Mirror the environment-driven follow-up logic from web
- [ ] Submit `environmentContext` inside the structured `symptoms` payload
- [ ] Keep older array-only symptom payload handling safe where needed
- [ ] Show environmental context in patient report / case detail when present
- [ ] Show environmental context in doctor case detail when present
- [ ] Verify case creation still works when no environmental context is provided

## H. Files Changed In Web

- `D:\Web\public\patient-case-create.html`
- `D:\Web\public\js\patient\case-create.js`
- `D:\Web\public\js\patient\questionnaire-config.js`
- `D:\Web\public\js\patient\report-utils.js`
- `D:\Web\public\js\patient\case.js`
- `D:\Web\public\js\doctor\case.js`
- `D:\Web\src\modules\cases\cases.schemas.js`
- `D:\Web\src\modules\cases\cases.service.js`
