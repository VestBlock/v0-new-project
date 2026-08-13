# VestBlock decision-room hero assets

## Approval gate H2

The desktop and mobile proofs were approved as the visual target before hero implementation. Both scenes preserve the Black business owner as the human lead, replace the former holographic person with an unmistakably physical robot, and make the shared-document interaction legible.

| Asset | Use | Source and settings | Third-party license | Incremental asset cost |
| --- | --- | --- | --- | --- |
| `public/hero/decision-room-v2/desktop-poster.webp` | Desktop poster, loading state, failure state, and reduced-motion fallback | OpenAI built-in image generation; precise-object edit from the approved Material Ledger opening poster; 1672×941; photorealistic cinematic editorial direction | None; generated for this VestBlock project | $0 external stock/licensing spend |
| `public/hero/decision-room-v2/mobile-poster.webp` | Dedicated mobile poster, loading state, failure state, and reduced-motion fallback | OpenAI built-in image generation; precise-object edit from the approved desktop proof; 941×1672; dedicated portrait composition | None; generated for this VestBlock project | $0 external stock/licensing spend |
| `public/hero/decision-room-v2/robot-pointing.webp` | Live composited assistant layer | OpenAI built-in image generation; isolated matching robot on flat chroma background, locally keyed and edge-validated; 900 px wide WebP with alpha | None; generated for this VestBlock project | $0 external stock/licensing spend |
| `public/hero/material-ledger/desktop.*` and `mobile.*` | Existing real owner motion retained inside the framed decision-room scene | Existing approved VestBlock repository media; no new download or purchase | Existing project asset | $0 new spend |

The built-in image-generation tool does not expose its underlying model identifier, seed, or per-image billing in this environment. No stock library, paid video service, or third-party visual was added.

## Direction prompts

Desktop proof: preserve the Black business owner at a real decision desk; replace the translucent human assistant with a physical graphite-and-dark-titanium robot; show the owner marking a document while the robot points to the same evidence; refine the setting into a credible near-future executive office; use restrained acid-lime status accents; avoid cyberpunk, gaming UI, particles, hexagons, orbs, and decorative charts.

Mobile proof: create a genuine 9:16 composition rather than a desktop crop; keep both faces, both sets of hands, the marked document, and the robot's pointing gesture visible; preserve the credible office, real materials, warm practical light, and restrained industrial design.

Robot layer: reproduce the approved physical robot as an isolated three-quarter seated figure facing screen-right; include the complete head, torso, arms, hands, and precise downward pointing gesture; use a uniform magenta key background; remove that background locally with a soft matte and despill pass.

## Acceptance record

- Desktop proof: passed — physical robot, clear owner/robot/document triangle, high material detail.
- Mobile proof: passed — true portrait framing, both actors and the shared work surface remain visible.
- Robot layer: passed — clean silhouette and alpha, complete pointing hand, no human or holographic features.
- Normal-motion implementation must still use moving footage and real-time state changes. The posters are only fallbacks and art-direction references.
