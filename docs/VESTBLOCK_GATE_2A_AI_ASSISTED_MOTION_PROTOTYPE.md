# VestBlock Gate 2A — AI-Assisted Material Ledger Prototype

Status: **passed fresh-eyes review; ready for owner approval; not implemented or deployed**  
Prepared: August 12, 2026

Gate 2A preserves the approved Material Ledger footage and adds a restrained, human-scale holographic assistant. The Black business owner remains the primary subject and supplies the real movement: he reviews, turns, repositions, and marks physical documents. A waist-up assistant presence, document-aligned evidence marker, and localized smoked-glass plane support that work without replacing it.

## Art direction

The direction is **quiet spatial intelligence**. The assistant is a Black woman rendered as a warm-ivory and acidic-lime light presence in contemporary professional clothing. She is oriented toward the owner and his documents, not toward the visitor. She is recessed into one localized architectural glass plane and deliberately lacks scanlines, wireframe, a neon outline, or a floating dashboard. The only additional spatial detail is a document-aligned evidence marker. There are no orbs, node networks, hexagons, blue HUDs, robots, fictional financial figures, or generated pseudo-text.

Important labels remain live HTML:

- Illustrative AI support
- Reviewing supplied documents
- Organizing visible criteria
- Preparing options for review
- Capital file
- Deal evidence
- Next-move plan

The assistant is a supporting visual metaphor. The prototype makes no claim that AI guarantees financing, approvals, credit changes, grants, investment returns, or deal outcomes.

## Storyboard

| Time | Physical action | AI-assisted state | Meaning |
| --- | --- | --- | --- |
| 0–4 seconds | The owner opens and reviews the working file. | **Reviewing supplied documents**; Capital file is active. | Organize purpose, documents, and readiness. |
| 4–8 seconds | Pages and evidence are moved for comparison. | **Organizing visible criteria**; Deal evidence becomes active. | Bring facts and criteria into a structured review. |
| 8–12 seconds | The owner marks the file and closes the decision loop. | **Preparing options for review**; Next-move plan becomes active. | Prepare a human-reviewable next step without promising an outcome. |
| Scroll | The visitor moves beyond the opening frame. | The spatial-office layer contracts and fades into the Capital, Deals, and Opportunity directory. | The assistant yields to navigation and choice. |

## Prototype and evidence

- Interactive prototype: `/Users/mrsanders/Downloads/Codex Folder/output/playwright/gated-completion/gate-2a/prototype/index.html`
- Desktop Capital: `/Users/mrsanders/Downloads/Codex Folder/output/playwright/gated-completion/gate-2a/evidence/desktop-capital.png`
- Desktop Deals: `/Users/mrsanders/Downloads/Codex Folder/output/playwright/gated-completion/gate-2a/evidence/desktop-deals.png`
- Desktop Opportunity: `/Users/mrsanders/Downloads/Codex Folder/output/playwright/gated-completion/gate-2a/evidence/desktop-opportunity.png`
- Mobile: `/Users/mrsanders/Downloads/Codex Folder/output/playwright/gated-completion/gate-2a/evidence/mobile.png`
- Holographic-office concept frame: `/Users/mrsanders/Downloads/Codex Folder/output/playwright/gated-completion/gate-2a/assets/holographic-office-concept.png`
- Optimized assistant layer: `/Users/mrsanders/Downloads/Codex Folder/output/playwright/gated-completion/gate-2a/assets/assistant-glass-optimized.png`

The documentary footage remains Pexels video 5683801, “A Man Working Late at an Office,” identified by its source page as free to use. The assistant concept and alpha layer were produced with OpenAI built-in image generation. The interface did not expose a separate per-image charge. The revised assistant was generated waist-up on a flat `#ff00ff` chroma background, keyed locally with the bundled Pillow runtime, and reduced from 1,890,884 to 246,225 bytes for prototype delivery.

## Media and performance

The prototype reuses the verified Gate 2 video encodes and adds the 246,225-byte assistant layer.

| Asset | Format / dimensions | Size |
| --- | --- | ---: |
| Desktop WebM | VP9, 960×540, 12 seconds | 312,938 bytes |
| Desktop MP4 | H.264, 1280×720, 12 seconds | 934,876 bytes |
| Mobile WebM | VP9, 540×960, 12 seconds | 344,075 bytes |
| Mobile MP4 | H.264, 720×1280, 12 seconds | 818,015 bytes |
| Assistant | Alpha PNG, 420×630 | 246,225 bytes |
| Opening poster | JPEG | 60,526 bytes |
| Reduced-motion fallback | JPEG | 59,319 bytes |

Chrome selected WebM in both local tests. On the Mac Pro local HTTP prototype, resource transfer completed in 73.1 ms for desktop video and 82.7 ms for mobile video; the assistant PNG completed in approximately 160 ms. DOM navigation to confirmed playable media measured 2,384 ms on desktop and 2,166 ms on mobile. These are local prototype observations, not production field data. Gate 3 must optimize and remeasure the production implementation.

## Accessibility and responsive verification

- Tested at 320, 390, 768, 1024, and 1440 CSS pixels with zero horizontal overflow.
- WebM was decoded, ready, and playing at every width.
- The revised assistant alpha asset loaded at every width.
- Pause/play and doorway controls meet the 44×44-pixel minimum interactive target.
- Doorways retain visible hover, current, and keyboard-focus states.
- The questionnaire CTA resolves to `#questionnaire`.
- Browser page-error collection returned no errors.
- With `prefers-reduced-motion: reduce`, video is hidden and paused, the playback control is removed, and the static fallback remains visible.

## Tool decision

No paid motion tool is required for Gate 3. The present toolbelt can support the approved direction with real footage, image generation, alpha compositing, HTML/CSS, GSAP or Framer Motion for choreography, and FFmpeg for delivery encodes. Production implementation should keep the assistant as a subordinate layer, lazy-load noncritical below-fold media, and preserve a fast poster-first opening.

## Independent review history

The first fresh-eyes review blocked the full-body version because the glowing silhouette, transparent grid, and floating rail read as generic AI/crypto imagery and competed with the owner and physical ledger. It also blocked the completed-state phrases “Documents reviewed,” “Criteria matched,” and “Options compared” because the scene did not display evidence sufficient to substantiate those conclusions. The revised prototype removes those visual motifs, limits the assistant to a subdued waist-up presence inside one smoked-glass plane, and uses explicitly illustrative, in-progress language.

The same independent reviewer rechecked the exact revised desktop and mobile evidence and returned **PASS**. The reviewer confirmed that the assistant is now recessed and subordinate to the physical-review footage and that the status copy is framed as illustrative, in-progress support rather than a completed or guaranteed automated conclusion.

## Approval boundary

Production remains on the preserved Gate 0 release. Gate 3 may begin only after the owner approves this Gate 2A direction. Approval authorizes implementation, not production deployment, live outreach, unattended sending, or advertising spend.
