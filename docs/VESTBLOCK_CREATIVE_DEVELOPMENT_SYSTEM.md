# VestBlock Creative Development System

This system governs new public marketing scenes. It exists to keep VestBlock specific, commercial, and visually authored as the platform grows.

## Required workflow

`reference → art direction → storyboard → asset plan → scene prototype → motion choreography → integration → screenshot critique → performance pass → release`

Do not skip directly from a visual reference to an oversized component implementation.

## Architecture

- **Next.js / React:** semantic content, routing, server-rendered conversion paths.
- **React Three Fiber + Drei:** the progressive WebGL rendering layer; lazy-load scene code and preserve HTML fallbacks.
- **GSAP + ScrollTrigger:** one scene timeline per experience. Do not scatter unrelated animation hooks across components.
- **Lenis + r3f-scroll-rig:** the planned global smooth-scroll/shared-canvas architecture for multi-scene pages. Do not turn on smooth scrolling globally until keyboard, anchor, reduced-motion, and mobile validation pass.
- **Theatre.js:** authored camera/light/object keyframes once the shared scene runtime is introduced. Its runtime is kept decoupled from page copy and conversion logic.
- **Postprocessing:** restrained bloom, vignette, grain, depth cues, and only scene-specific effects that survive visual QA.
- **glTF Transform + meshoptimizer:** mandatory inspection and compression path for any future GLB/GLTF asset. Never place unoptimized source models in `public/`.

## VestBlock shader/material library

Reusable names and intent:

| Material | Purpose | Guardrail |
| --- | --- | --- |
| `PropertyActivationMaterial` | Map/building activation and verified window state | Preserve material realism; avoid equal brightness across the entire model. |
| `RoutePulseMaterial` | Route propagation through the decision network | One active route is the focus; idle routes are quiet. |
| `DataScanMaterial` | Evidence-plane traversal and property inspection | Must convey a data state change, not decorative scanlines. |
| `ArchitectureRevealMaterial` | Facade/parcel reveal and transition | Use as a mask between property states. |
| `VaultMaterial` | DealVault compression and privacy state | Dense graphite form with scarce signal edges. |
| `TransitionDisplacementMaterial` | Motivate a scene change through geometry/image deformation | Use only at scene boundaries; respect readability. |

The first hero implementation uses shader-compatible uniforms and material naming, but does not introduce a shader merely to perform a CSS-sized effect. Custom GLSL/TSL enters only when it improves a storyboard transition.

## Performance budgets

- Dynamically import public 3D scenes; avoid WebGL on compact/coarse-pointer devices unless it is visually and interactionally sound.
- Canvas device-pixel ratio: clamp around 1.5–1.75 on desktop and 1 on constrained devices.
- One render context per page; a shared global canvas is the target architecture for future multi-scene work.
- Pause/reduce rendering when the scene is offscreen or the document is hidden.
- Keep direct scene geometry modest; use instancing for repeated architectural elements.
- Every GLB/GLTF must be inspected, pruned, texture-resized, and Meshopt/Draco evaluated before merge.
- Keep essential brand language, CTA targets, and SEO content in the DOM.

## Render → critique → revise protocol

Use the installed design skills and the following roles as an independent review loop:

1. **Creative director:** checks concept, domain specificity, composition, type, color, and storyboard before code polish.
2. **Implementation director:** builds from the treatment while protecting accessibility, performance, and conversion.
3. **Visual judge:** inspects rendered screenshots—not code—and rejects generic startup patterns, gratuitous glass, equal card grids, excessive rounded surfaces, weak hierarchy, bloated hero height, or generic glowing objects.

The person or agent implementing a scene must perform the visual-judge pass from the documented QA rubric before declaring the result done.

## Future-agent operating commands

- `critique`: identify the one or two changes with the largest improvement to composition and specificity.
- `audit`: inspect design-system drift, responsiveness, accessibility, and render performance.
- `animate`: choreograph only an intentional transition or interaction.
- `distill`: remove decorative layers that do not serve hierarchy.
- `bolder` / `quieter`: change emphasis without losing the approved VestBlock visual language.
- `optimize`: reduce client/runtime cost and asset weight before release.
- `polish`: run screenshot comparison after the system is already coherent.

## Definition of done for a public scene

1. It is unmistakably property, opportunity, capital, routing, DealVault, and VestBlock without explanatory paragraphs carrying the entire meaning.
2. At least one deliberate, bespoke scene transition binds adjacent content.
3. It remains commercially understandable and contains a direct conversion action.
4. It passes screenshot review at the designated desktop, laptop, tablet, and mobile breakpoints.
5. It honors reduced motion and WebGL-unavailable fallbacks.
6. It meets the project’s typecheck, lint, build, smoke, and production checks.

