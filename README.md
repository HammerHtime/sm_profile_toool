# Public Footprint

Interactive privacy-awareness and digital-footprint presentation web app.

## Deployment

Production is designed for Netlify deployment from the `main` branch.

- Publish directory: repository root
- Functions directory: `netlify/functions`
- Node: 22.12+
- Netlify Blobs: temporary QR/photo-demo session and consent-audio storage
- Primary live-search provider: Brave Search API
- Connected-story synthesis: OpenAI Responses API
- Reverse-image web matching: Google Cloud Vision WEB_DETECTION
- Broad location normalization: Google Geocoding API

## Required Netlify environment variables

Set these in **Netlify → Site configuration → Environment variables**:

```
BRAVE_SEARCH_API_KEY=<your Brave Search API key>
OPENAI_API_KEY=<your OpenAI API key>
GOOGLE_VISION_API_KEY=<your Google Cloud Vision API key>
GOOGLE_GEOCODING_API_KEY=<your Google Geocoding API key>
```

Optional model override:

```
OPENAI_MODEL=gpt-6-luna
```

All API keys remain server-side and are never returned to the browser. OpenAI synthesis requests use `store:false`.

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

### Connected-story synthesis

After Brave returns masked public excerpts, the server sends only those already-masked excerpts to the OpenAI Responses API. The synthesis layer turns fragments into a short narrative, evidence-anchored story points and a broad timeline. It is instructed not to infer sensitive traits, expose exact addresses, profile minors, invent dates, or turn weak clues into facts. If OpenAI is unavailable, the app falls back to a simpler deterministic summary instead of substituting fabricated findings.

### Reverse-image web matching

The consented photo is sent transiently to Google Cloud Vision using `WEB_DETECTION`. The app keeps only sanitized match counts, broad web entities and matching-page domains/URLs in the temporary demo session. It does not use facial identification. The original image is not persisted by this application.

### Broad location intelligence

The AI synthesis may identify city or regional place names only when they are supported by the supplied public evidence. Google Geocoding normalizes up to four of those broad places for consistent city/region display and mapping. Exact addresses, schools, private properties and precise coordinates are not returned to the presentation.

For photo GPS, the application first reduces the original coordinate to a 50 km privacy zone. Only that already-coarsened zone centre is sent for reverse geocoding, so the exact embedded coordinate is not sent to the geocoder.

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


## October 2026 presentation hardening

The production presentation now includes explicit regression protection for the issues found during real-world testing:

- result stages scroll safely instead of clipping lower panels behind navigation controls
- compact findings use stable grid columns and vertically separated provenance labels
- non-social news/article URLs are no longer rendered as fake matched-account handles
- social privacy walkthroughs have concrete phone-row/header renderers rather than blank phone screens
- phone walkthrough navigation uses a native-style screen push while the teaching copy cross-fades independently
- when the presenter supplies identity clues, same-name results must overlap a supplied clue before they can survive as a name-based match
- short clue aliases are token-matched so strings such as `https` cannot accidentally satisfy an acronym clue


### Natural AI voice output

The presenter no longer uses the browser's built-in speech synthesizer. Generated demonstration sentences are rendered server-side through the OpenAI Speech API with `gpt-4o-mini-tts` and the `marin` built-in voice. The UI clearly labels the result as AI-generated and not cloned. The volunteer's recording is not used to reproduce vocal identity; only a coarse speaking-rate factor may influence delivery.

### Theme and identity hardening

Narrative excerpts, recurring themes and ambient thumbnails now use only corroborated strong-identity sources. A single result can no longer create a "recurring theme"; a term must occur across at least two eligible public results. A regression test specifically rejects the unrelated Andrew Hammond psychotherapist profile in Spencerville when the supplied identity clues are Toronto Police and University of Western Ontario.


### Device privacy walkthroughs

The iPhone and Android privacy guides now use the same teaching model as the social-app guides: tap-by-tap navigation, return to the parent menu before the next permission, then show the actual permission choices. Each terminal setting screen includes why the setting matters, the device's normal/default permission behaviour, and a recommended privacy-focused setting. iPhone coverage includes Location Services, Precise Location, Tracking, Contacts, Photos, Camera, Microphone, Local Network and Safety Check. Android coverage includes Location, precise/approximate location, Camera, Microphone, Photos and videos, Contacts, unused-app permission reset and Privacy dashboard.
