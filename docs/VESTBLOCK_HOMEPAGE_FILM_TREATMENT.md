# VestBlock Homepage Film Treatment

**Status:** approved creative-development brief  
**Scope:** VestBlock LLC homepage enhancement. This is not a rebrand. Capital, Deals, Opportunity, DealVault, the approved mark, routing, privacy, and conversion paths remain intact.

## 1. Visual concept — "The move takes shape"

VestBlock is a real-estate decision system, not a generic software dashboard. The homepage is a controlled cinematic passage from a raw property signal to a private, actionable record. It should feel authored by a creative-development studio, while staying clear enough for a first-time commercial visitor.

The central object is a **property signal**: an architectural massing model with parcel geometry, data markers, routing paths, and the dimensional VestBlock mark. It changes state as the visitor moves: **property → evidence → route → DealVault record → platform entry**. A transition must carry a visual idea from one beat into the next; no independent fade-only sections.

**Commercial / creative balance:** 70% immediate product clarity, 30% exceptional spatial experience.

## 2. Color world

- **Obsidian** `#080a08`: the architectural void and principal field.
- **Bone** `#f3efe6`: decisive information, type, and measured contrast.
- **VestBlock signal lime** `#b7ff3c`: an active route, verified state, or energy transfer—not general decoration.
- **Mineral graphite** `#292d27`: massing material, structural planes, and background depth.
- **Oxidized green** `#526142`: deep field falloff and unseen system activity.

The lime is deliberately scarce. If a surface would still work in gray, it should usually remain gray.

## 3. Material and lighting language

- Architectural massing uses graphite anodized metal, frosted glass, and narrowly illuminated interior planes—never toy-like plastic.
- Property data is represented by thin emissive routes, survey lines, and evidence points, not dashboards pasted onto a canvas.
- Key light: a narrow, cool overhead source; rim light: a low signal-lime edge only when a route becomes active.
- The black field has visible depth through falloff, fog, grain, and restrained reflection. Bloom stays below the point where it softens type or makes the object cyberpunk.

## 4. Camera language

The camera treats scroll as a directed shot list, not a progress meter. It uses asymmetric framing: the spatial subject may occupy the right two-thirds while language anchors left, then reverse as the route crosses the frame. The camera moves in pushes, lateral reveals, and an intentional compression into the DealVault state. It never orbits aimlessly.

Desktop focal range is approximately 34–42 degrees. On mobile, the camera becomes a concise vertical composition: one focal object, one readable statement, then the conversion path. It does not attempt to compress the desktop movie.

## 5. Typography language

Typography has two roles:

1. **Editorial statement:** large bone-colored sentence fragments, tightly composed and revealed through a mask/clip path.
2. **Instrument readout:** compact monospaced labels for scene, evidence, and route status.

Only the editorial statement participates in a pronounced perspective/mask reveal. Labels move minimally and remain legible. No perpetual kinetic type, typewriter animation, or gratuitous split-every-character effect.

## 6. Interaction language

- **Proximity activation:** pointer movement subtly biases the property massing and lights up the closest routing nodes.
- **Lane selection:** Capital, Deals, and Opportunity reweight the live route and update the semantic readout; it is a real choice, not a decorative carousel.
- **Scene progress:** scroll advances camera/object/typography states together.
- **Reduced-motion and compact devices:** retain the complete visual hierarchy as a still architectural state and regular document flow; no critical information depends on WebGL.

## 7. Transition language

1. **Architectural reveal:** survey grid and building volume rise from the void.
2. **Data scan:** an evidence plane moves through a facade, activating verified points.
3. **Route propagation:** a line leaves the property and becomes an active path between Capital, Deals, and Opportunity.
4. **Spatial typography:** route energy crosses the frame and resolves into the next statement.
5. **DealVault compression:** routing geometry tightens into a protected record / VestBlock mark.
6. **Portal to product:** the object stabilizes beside the explicit entry action.

Each scene must physically motivate the next. A simple opacity fade is only allowed to protect readability.

## 8. Motion principles

1. One visual idea per beat.
2. Motion clarifies hierarchy and state; it is never a filler effect.
3. Ease into and out of camera shots; reserve hard cuts for semantic state changes.
4. Keep the route's energy continuous, even when the visual subject changes.
5. Respect user motion preferences and coarse-pointer devices.
6. Use a finite palette: architectural reveal, route propagation, camera push, data scan, typography mask, spatial transition, DealVault compression.

## 9. Sound approach

No autoplay audio. If sound is introduced later, it must be an explicit opt-in with a visible control, and it may only support the transition language with low-volume material/route cues.

## 10. Storyboard — homepage film key frames

| Frame | Scroll beat | Camera / composition | Spatial state | DOM and transition state |
| --- | --- | --- | --- | --- |
| 01 | 0% — Introduction | Wide, asymmetric: statement left, shadowed object right | Dimensional VB rests over a survey field | "Find the move before it becomes obvious." masked in; explicit direction CTA visible. |
| 02 | 10% — Signal found | Slow push toward lower-right parcel | Mark thins into a site boundary; first elevation lines appear | Scene label changes to **01 / Property signal**. |
| 03 | 22% — Discovery | Lateral reveal across the parcel | Building massing rises; address/evidence nodes resolve | "A property is more than a listing." enters through route mask. |
| 04 | 35% — Analysis | Closer three-quarter elevation | A scanning plane traverses facade and marks verified geometry | **02 / Evidence visible** readout appears; nonessential introductory copy recedes. |
| 05 | 48% — Capital | Camera pulls slightly left to create a route corridor | One route branches toward Capital; a low rim light confirms state | Lane selection biases the route color and destination. |
| 06 | 61% — Routing | Wider frame; route crosses foreground into depth | Capital, Deals, Opportunity nodes lock into a single network | Route line briefly becomes spatial typography: "Keep the facts with the move." |
| 07 | 74% — DealVault | Controlled top-down compression | Building, nodes, and paths fold into a protected record volume | **05 / DealVault** enters, framing privacy and proof without a card-grid. |
| 08 | 86% — Platform | Camera returns to a confident three-quarter product view | Record resolves into the dimensional VB mark; routes remain embedded | Existing approved paths begin below as the product entry threshold. |
| 09 | 94% — Entry | Object moves out of visual center, preserving negative space | Mark locks; active lane remains visible | "Choose a direction" anchors to the existing Capital / Deals / Opportunity path section. |
| 10 | 100% — Release | Clear exit frame | Visual energy resolves; canvas sleeps when offscreen | Standard semantic content continues in document flow. |

## 11. Visual QA gate

Before a release, inspect still frames at 1440×900, 1366×768, 1024×768, 430×932, and 390×844 at the storyboard beats. Validate:

- no generic feature-card interpretation of the scene;
- foreground, middle ground, background, focal subject, and negative space exist at every key frame;
- essential copy is HTML and remains readable without canvas/WebGL;
- no text is clipped, no page horizontal overflow exists, and no console errors appear;
- scroll changes the scene meaningfully, not merely the object position;
- reduced motion retains a confident static composition;
- WebGL failure falls back to the same CTA and semantic content.

