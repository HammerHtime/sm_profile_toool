# Public Footprint

Interactive privacy-awareness and digital-footprint presentation web app.

## Deployment

The production site is designed for Netlify deployment from the `main` branch.

- Publish directory: repository root
- Functions directory: `netlify/functions`
- Node: 20+
- Netlify Blobs: used for temporary 15-minute photo-demo sessions

## Required Netlify environment variable

Real public-name search uses the Brave Search API from the server-side Netlify function.

Set this in **Netlify → Site configuration → Environment variables**:

```
BRAVE_SEARCH_API_KEY=<your Brave Search API key>
```

The key is never sent to the browser.

The app performs a readiness check at page load:
- Green status = live public search is configured.
- Amber status = the API key is missing or readiness could not be confirmed.
- Synthetic Demo remains available even when live search is unavailable.

## Search modes

### Live Search

Uses public/indexed web results only. Each displayed public result includes a source URL and match confidence. Age and presenter-supplied clues are soft relevance signals, not hard filters.

### Synthetic Demo

Generates fabricated presentation data when a live search is too sparse for the teaching demonstration. Synthetic results are clearly labelled throughout the interface and must not be presented as findings about the person entered.

## Live photo demo

Presenter creates a 15-minute QR session. The volunteer can:

1. Take a new photo with their phone camera, or
2. Choose an existing photo from their photo library.
3. Preview the selected image.
4. Confirm consent.
5. Submit.

After submission, the presenter screen automatically begins the animated analysis. The app may extract real file-level metadata such as capture-time, camera/device metadata and embedded GPS. Exact GPS is not returned to the presentation. When GPS exists, the presentation receives only a coarse 50 km privacy zone.

The demo does not use facial recognition or identify a person from their face.

## Privacy guide presentation

Privacy and parental-control walkthroughs use cinematic app/device entry transitions. Mouse wheel, presentation clicker keys and highlighted in-phone rows can advance the walkthrough.

The iPhone parental-control path is aligned to current iOS 27 Apple guidance and should be rechecked when Apple changes menu labels.

## Development rule

Never represent synthetic values as verified findings. Real findings require a public source or direct file-level verification.
