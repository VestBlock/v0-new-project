# VestBlock Design System

## Brand position

VestBlock helps people find capital, deals, and opportunities. The interface should feel financially credible, calm, direct, and built for action. AI is infrastructure, not decoration.

## Brand mark

The canonical digital monogram is `public/brand/vestblock-monogram.png`: an
interlocked lime V and graphite B derived from the approved VestBlock artwork.
It has a transparent background and is optimized to 768 × 768 for navigation,
hero, and WebGL use.

- Keep the mark’s aspect ratio and transparent padding intact.
- Use `object-contain`; do not crop it into a rounded square.
- Use the full VestBlock wordmark beside it in navigation or compact lockups.
- The dimensional mark may anchor the homepage network, but it should not become
  a repeated decorative stamp throughout content sections.
- Do not recolor it blue or purple, add a glow, or place it on a conflicting
  lime surface.

## Core tokens

The canonical implementation lives in `app/globals.css`.

| Token | Value | Use |
| --- | --- | --- |
| `--background` | `#070809` | Primary page background |
| `--background-secondary` | `#0A0C0E` | Section contrast |
| `--surface` | `#0E1114` | Functional surfaces |
| `--foreground` | `#F4F1EA` | Primary copy |
| `--muted-foreground` | cool gray | Supporting copy |
| `--primary` | `#B7FF3C` | Primary action and selected state |
| `--border` | restrained graphite | Dividers and boundaries |

Lime is a signal, not a background treatment. Cyan is reserved for rare system meaning. Gradients, glow, and blur are not default surface treatments.

## Typography

- Display: large, tight leading, short line length, one clear claim.
- Heading: sentence case by default; uppercase only for compact labels.
- Body: warm ivory or cool gray with readable line length.
- Mono/data: identifiers, pathway numbers, and compact operational data.
- Weight: use contrast deliberately; avoid stacking many weights in one component.

## Layout and spacing

- `.vb-page` supplies the page foundation.
- `.vb-container` sets the shared content width and responsive gutters.
- `.vb-section` establishes vertical rhythm.
- Use editorial dividers and spatial grouping before adding cards.
- Radius is restrained. A container earns a border and radius only when it represents a real object, control, or bounded task.

## Components

- `.vb-button`: primary action; lime fill, dark text, clear focus state.
- `.vb-button-secondary`: secondary action; quiet outlined treatment.
- `.vb-button-quiet`: tertiary action when required.
- `.vb-text-link`: inline or editorial route link.
- `.vb-eyebrow`: short orientation label.
- `.vb-section-title`: shared section-heading scale.
- `.vb-enter`: short progressive entrance with reduced-motion fallback.

Forms must keep visible labels, meaningful errors, keyboard focus, and a single primary submit action. Loading and empty states should say what is happening and what the user can do next.

## Motion and 3D

- Motion explains hierarchy, state, or connection.
- The homepage network is the only WebGL statement in this phase.
- Heavy code is dynamically loaded; rendering pauses when hidden or off-screen.
- Geometry and DPR adapt to device capability.
- `prefers-reduced-motion` removes nonessential entrances and provides a calmer scene.
- Do not add scroll-jacking, cursor-chasing, decorative particles, or duplicate animation libraries.

## Copy rules

- State the concrete user outcome.
- Prefer “See funding options that fit your profile” to abstract promises.
- Do not invent metrics, approvals, inventory, testimonials, or partner counts.
- Avoid stock AI language, dramatic fragments, vague superlatives, and repetitive three-card feature sections.
- Each page has one primary job: route, start a capital path, enter a deal workflow, discover a relevant resource, or advance active work.

## Accessibility and QA gates

- WCAG AA contrast for normal text.
- Visible focus states and logical tab order.
- Semantic headings and landmarks.
- Mobile tap targets and no horizontal overflow at 390px.
- Escape closes the mobile navigation and restores body scrolling.
- Desktop, tablet, mobile, and reduced-motion checks before release.
- Lighthouse is evidence, not a substitute for browser and keyboard testing.

## Anti-slop review

Reject a primary page when its clarity depends on gradients, pill badges, stacked cards, fake metrics, identical layouts, giant empty scroll regions, generic AI terminology, or multiple equally weighted CTAs. Preserve useful irregularity and authored rhythm.
