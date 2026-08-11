# VestBlock Open-Source UI and Motion Stack

Reviewed 2026-08-10. Dependencies are ingredients, not templates. Any copied component becomes VestBlock-owned application code and must pass accessibility, performance, and AI-slop review.

| Project | License / maintenance signal | VestBlock decision | Guardrail |
| --- | --- | --- | --- |
| shadcn/ui | MIT; active React/Tailwind registry | **Adopt existing foundation.** VestBlock already owns a broad local `components/ui` set. | Consolidate tokens and variants; do not add near-duplicate primitives. |
| Magic UI | MIT; active repository, copy/paste animated components | **Reference selectively.** No package is required for this phase. | Adapt only an interaction with a clear job. No ornamental border beams, text effects, or card grids by default. |
| Aceternity UI | Free and premium catalog with its own Aceternity license for purchased items | **Inspiration only for this phase.** | Do not copy premium source without verified entitlement and attribution/license review. Build original VestBlock patterns. |
| Three.js | MIT; current `r184`, already installed as `three ^0.184.0` | **Keep for the single opportunity-network scene.** | Dynamic client load, adaptive DPR, pause off-screen, dispose resources, static fallback. |
| React Three Fiber | MIT; v9 supports React 19 | **Defer.** Existing original Three.js scene is already implemented and avoids another renderer dependency. | Re-evaluate only if scene complexity becomes harder to maintain than the dependency cost. |
| Drei | MIT helpers for R3F | **Do not add now.** | Only relevant if R3F is adopted. |
| GSAP | GreenSock standard no-charge license; current package already installed | **Keep only where scroll choreography needs it.** | One scroll orchestration layer; always clean up triggers and respect reduced motion. |
| Motion / Framer Motion | Actively maintained React animation library; already installed | **Keep for component entry/state motion.** | Use reduced-motion hooks and avoid animating essential content from invisible states in a way that breaks screenshots, indexing, or no-JS comprehension. |
| Lenis | MIT; current 1.3.x and already installed | **Use sparingly on the marketing homepage.** | Disable for reduced motion and avoid native-scroll breakage; remove if it does not materially improve the experience. |
| Paperclip | MIT; self-hosted agent orchestration with goals, org charts, budgets, approvals, audit, workspaces, and Codex adapter support | **Install beside VestBlock as an internal control plane.** | Local/authenticated access only, telemetry disabled, least-privilege secrets, budgets, approval gates, no autonomous production deployment. |

## Chosen animation split

- Three.js: the one meaningful network scene.
- GSAP + ScrollTrigger: scene/section scroll relationship only where CSS cannot express it cleanly.
- Motion: small component reveals and state transitions.
- Lenis: optional marketing-page scroll smoothing, disabled for reduced motion.
- CSS: hover, focus, and simple transitions.

Avoid using GSAP and Motion to animate the same property on the same element. Essential copy and calls to action render visibly in the initial HTML; animation enhances them rather than gating them.

## Component adoption checklist

Before adding any third-party-inspired component:

1. Name the user problem and intended action.
2. Confirm local primitives cannot solve it simply.
3. Verify license and attribution obligations at the exact source revision.
4. Copy only the minimum code; remove unused dependencies and effects.
5. Test keyboard, screen reader, reduced motion, touch, and 320–1440 px layouts.
6. Measure bundle and main-thread impact.
7. Rewrite styling and copy into the VestBlock design language.
8. Reject it if its primary justification is “it looks cool.”

## Security and supply-chain policy

- Prefer local source-owned shadcn-style components over runtime component packages.
- Pin newly adopted packages; do not use unreviewed `latest` for new dependencies.
- Run package audit and inspect install scripts before adoption.
- Do not give UI libraries access to secrets, server credentials, database clients, or privileged APIs.
- Keep Paperclip dependencies and runtime outside the consumer application repo and process boundary.
- Record exact Paperclip revision and install method in `docs/PAPERCLIP_VESTBLOCK.md`.
