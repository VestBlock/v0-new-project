# VestBlock homepage visual treatment

## Direction

**Parcel Ledger** treats a real-estate opportunity as a physical asset with a capital path and a retained decision record. The visual language borrows from building surveys, deal files, material samples, and measured site boundaries. It avoids generic fintech graphs, floating interface panels, decorative grids, and stock “city of the future” imagery.

The signature device is the **capital thread**: a restrained acid-lime parcel line that appears in the hero and reappears as a structural guide through the opportunity-preparation sequence. It is a wayfinding cue, not an animated graph.

## Diagnosis and replacement map

| Previous cue | Why it weakened the experience | Replacement |
| --- | --- | --- |
| Generic city video | It established real estate, but not an individual asset, deal context, or decision. | A bespoke property-intelligence aerial showing one detailed mixed-use property, parcel boundary, access, context, and selected route signals. |
| Scan grid and ticker | These were decorative technical shorthand with no relationship to a visitor’s task. | Survey-like parcel contours and a three-part review rail tied to property context, capital path, and record continuity. |
| Floating glass cards | They were generic SaaS overlays and competed with the hero message. | A quiet evidence rail and an illustrative preparation record integrated into the architecture of the scene. |
| Four cards connected by a glowing line | It described a sequence but looked like a template feature row. | A linear review sequence whose labels state the document, criteria, or decision produced at each stage. |
| Dashboard panel, bars, and sparkline | They implied analysis without showing what information supports a decision. | An illustrative preparation sheet organized around asset context, counterparty fit, capital readiness, and evidence continuity. |
| Partner role card grid | A directory does not explain why the right people should meet. | A criteria ledger that pairs each participant with the information they bring and an appropriate entry point. |

## Scene treatment

1. **Property signal** — A detailed aerial-oblique property image introduces a single address-like context without inventing a real listing. Concrete, dark glass, roof equipment, trees, curb lines, parking, and warm interiors make the asset feel physical. Parcel-boundary signals establish the point of attention.
2. **Property context** — The visitor sees the information required to define an opportunity: asset, use, timing, terms, and diligence material.
3. **Counterparty fit** — The sequence moves from the asset to acquisition criteria, operating capacity, and capital requirements. No outcome is promised.
4. **Capital readiness** — The copy frames capital requirements, use of proceeds, and missing diligence inputs as preparation material, not a credit, lending, or investment decision.
5. **DealVault** — The mark appears as a record seal inside the document architecture. It is not a floating logo object. Agreement versioning, milestones, payout references, and permissions are the visual subject.
6. **Entry** — The closing scene returns to the same capital thread and points visitors to an entry path.

## Motion rules

- The hero has one motion system: slow camera-scale travel through the property image plus a restrained capital-thread pass.
- Content moves off-stage as the visitor scrolls into the preparation sequence, so the transition represents moving from the property to the record.
- Section reveals use short, single-purpose opacity and vertical-position changes. There are no independently bobbing cards, orbiting nodes, ticker loops, or continuous decorative graphs.
- `prefers-reduced-motion` retains every state and removes nonessential movement.
- The mobile version retains the property image, copy, actions, and review rail; the nonessential visual record is intentionally removed rather than compressed into a broken miniature.

## Quality and performance intent

- The hero’s above-the-fold image is a single 213 KB WebP, using `fetchPriority="high"` and a stable full-bleed frame.
- The visual asset has an intentionally dark left corridor for text contrast and does not require live WebGL to be meaningful.
- Interactive elements retain visible keyboard focus. Essential conversion paths remain semantic links.
