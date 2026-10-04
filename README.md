# Public Footprint

Interactive privacy-awareness and digital-footprint presentation web app.

## Deployment

Production is designed for Netlify deployment from the `main` branch.

- Publish directory: repository root
- Functions directory: `netlify/functions`
- Node: 22.12+
- Netlify Blobs: temporary QR/photo-demo session and consent-audio storage
- Primary live-search provider: Brave Search API

## Required Netlify environment variable

Set this in **Netlify → Site configuration → Environment variables**:

```
BRAVE_SEARCH_API_KEY=<your Brave Search API key>
```

The API key remains server-side and is never returned to the browser.

The app checks backend readiness on page load:

- Green = live search is configured.
- Amber = the key is missing or readiness could not be confirmed.
- Synthetic Demo remains available as a clearly labelled fallback.

## Search modes

### Live Search

Uses public/indexed Brave Search results only.

The live result model includes:

- public source URLs
- strong vs possible identifier-match confidence
- server-side masking of email, phone and street-address fragments
- partial-result handling when an individual search pass fails
- public image thumbnails from Brave's privacy proxy, blurred during the presentation
- short masked public excerpts
- frequency-based recurring terms
- no facial identification
- no sensitive-trait inference

A minimum 14-second cinematic presentation window is enforced so fast searches still have time to build visually before the final results screen.

### Synthetic Demo

Creates clearly labelled fabricated presentation content when a real search is too sparse for the teaching demonstration. Synthetic data is never substituted into Live Search results and must never be presented as a finding about the searched person.

## Live photo / QR demo

The presenter creates a temporary QR session. The attendee can:

1. Scan the one-time QR link.
2. Enter a first name, optional city and optional public username.
3. Take a new photo or choose an existing photo.
4. Optionally record a short verbal-consent phrase.
5. Confirm checkbox consent.
6. Submit once.

The original photo is processed transiently. It is not persisted by the demo. The backend may extract capture date, camera/device metadata and embedded GPS. Exact GPS is never returned to the presentation; it is reduced to a broad 50 km privacy zone.

If the attendee supplies a public username, the server can correlate that handle with public/indexed webpages. Any Brave-proxy thumbnails, excerpts and recurring terms used in the search animation are temporary presentation data. The demo does not identify the attendee by face.

## Voice-awareness demo

The attendee may record this short phrase:

> Here is my photo, and I consent to it being used for this demonstration.

The original consent clip is stored only in the temporary session and can be replayed by the presenter.

The three generated example buttons deliberately use a **generic synthetic voice** adjusted only by approximate speaking pace. They do **not** reproduce the attendee's vocal identity or create an identity-level voice clone.

The purpose is to teach that short exposed voice samples can be harvested and manipulated, while real criminal tools can be used for impersonation, fraud and extortion.

## Data deletion and retention

- QR sessions expire after 15 minutes.
- **Erase Demo Data** deletes the temporary session and consent-audio blob.
- The presenter displays a visible secure-delete sequence and an **ALL DEMO DATA DELETED** confirmation.
- Hourly cleanup removes expired sessions and associated audio.
- A daily failsafe removes expired, orphaned and over-24-hour temporary demo data while leaving an active session untouched.
- Live name searches are not stored in an application search-history database.
- Browser demo state is reset on a 24-hour failsafe.
- External search-provider query records are governed by that provider's own retention and privacy terms.

## Privacy guides

The main privacy dashboard includes iPhone and Android device privacy walkthroughs plus platform-specific guides.

Parent Mode contains deeper iPhone Screen Time / Family controls, Android Family Link guidance and social-platform parent controls. Device/app transitions are presentation-clicker friendly.

## QA

Run:

```
npm ci
npm run qa
```

The QA command checks browser-script syntax, Netlify-function syntax, DOM ID references, duplicate IDs, explicit button types, required function endpoints, 14-second presentation timing, CSP requirements, the daily purge schedule and provenance/erase guardrails.

The GitHub Actions workflow runs the same QA checks on `main`, `qa-rc2` and pull requests targeting `main`.

## Development rules

- Never represent synthetic values as live findings.
- Real public results must retain their source and confidence.
- Strong match means multiple supplied identifiers matched. It is not proof of identity.
- Do not expose exact GPS on the presenter screen.
- Do not use facial identification.
- Do not create identity-level clones of an attendee's voice.
- Do not imply that application deletion also deletes third-party provider logs.
