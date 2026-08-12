# VestBlock Gate 2 — Material Ledger Motion Prototype

Status: **ready for owner approval; not implemented or deployed**  
Prepared: August 12, 2026

This gate keeps the approved Material Ledger direction while replacing still-image motion with real documentary footage. The scene features a Black business owner physically reviewing, turning, repositioning, and marking pages. Capital, Deals, and Opportunity are explained with live HTML rather than text baked into the media.

## Storyboard

| Time | Physical action | Live interface state | Meaning |
| --- | --- | --- | --- |
| 0–4 seconds | The owner opens and reviews the working file. | **Capital — Review the capital file.** Capital file is active. | Establish purpose, documents, and readiness. |
| 4–8 seconds | Pages and evidence are repositioned for comparison. | **Deals — Compare deal evidence.** Deal evidence is active. | Bring facts, criteria, and supporting material into review. |
| 8–12 seconds | The owner marks the file and resolves the review. | **Opportunity — Mark the next move.** Next-move plan is active. | Select the action that fits the goal, timeline, and current position. |

The three persistent doorways are clickable and route to `#capital-path`, `#deals-path`, and `#opportunity-path`. The paper directory moves into the hero as the visitor scrolls so the scene resolves into a structured choice instead of ending as a decorative video.

## Prototype and evidence

- Interactive prototype: `/Users/mrsanders/Downloads/Codex Folder/output/playwright/gated-completion/gate-2/prototype/index.html`
- Desktop Capital frame: `/Users/mrsanders/Downloads/Codex Folder/output/playwright/gated-completion/gate-2/prototype-desktop-capital-approved.png`
- Desktop Deals frame: `/Users/mrsanders/Downloads/Codex Folder/output/playwright/gated-completion/gate-2/prototype-desktop-deals-approved.png`
- Desktop Opportunity frame: `/Users/mrsanders/Downloads/Codex Folder/output/playwright/gated-completion/gate-2/prototype-desktop-opportunity-approved.png`
- Mobile frame: `/Users/mrsanders/Downloads/Codex Folder/output/playwright/gated-completion/gate-2/prototype-mobile-approved.png`
- Opening poster: `/Users/mrsanders/Downloads/Codex Folder/output/playwright/gated-completion/gate-2/assets/material-ledger-opening-poster.jpg`
- Reduced-motion fallback: `/Users/mrsanders/Downloads/Codex Folder/output/playwright/gated-completion/gate-2/assets/material-ledger-reduced-motion.jpg`

The source is Pexels video 5683801, “A Man Working Late at an Office.” The source page identifies the asset as free to use. Production implementation must preserve source and license records.

## Media delivery

| Asset | Codec / dimensions | Size |
| --- | --- | ---: |
| Desktop WebM | VP9, 960×540, 12 seconds | 312,938 bytes |
| Desktop MP4 | H.264, 1280×720, 12 seconds | 934,876 bytes |
| Mobile WebM | VP9, 540×960, 12 seconds | 344,075 bytes |
| Mobile MP4 | H.264, 720×1280, 12 seconds | 818,015 bytes |
| Opening poster | JPEG | 60,526 bytes |
| Reduced-motion fallback | JPEG | 59,319 bytes |

Chrome selected the WebM source. On the local Mac Pro HTTP test, the desktop resource completed in 155.3 ms and the mobile resource in 66.8 ms. DOM navigation to confirmed playable video measured 2,976 ms on desktop and 1,690 ms on mobile. Those timings are local prototype observations, not production field data; Gate 3 must rerun Lighthouse and deployed-browser checks after implementation.

## Accessibility and responsive verification

- Tested at 320, 390, 768, 1024, and 1440 CSS pixels with zero horizontal overflow.
- Video was decoded, ready, and playing at every test width; mobile selected the vertical WebM and larger widths selected the desktop WebM.
- Pause/play and all doorway targets meet the 44-pixel minimum interactive height.
- Doorways have visible hover, current, and keyboard-focus states.
- The questionnaire CTA resolves to `#questionnaire`.
- Browser console and page error collection returned no errors.
- With `prefers-reduced-motion: reduce`, video is hidden and paused, playback controls are removed, and the static fallback is shown.

## Tool decision

The existing toolbelt already contains GSAP, Framer Motion, Three.js, image generation, FFmpeg, and licensed-stock sourcing. No Rive asset or dedicated image-to-video generator is installed, but neither is required for this direction because the licensed source supplies authentic human and document motion. **Do not purchase an additional motion tool for Gate 3.** Use the existing video pipeline and reserve GSAP or Framer Motion for interface choreography only.

## Approval boundary

Production remains on the preserved Gate 0 release. Gate 3 may begin only after the owner approves both this motion direction and the Gate 1 homepage architecture. Approval authorizes implementation, not deployment; the later production gate remains separate.
