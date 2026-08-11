# VestBlock premium design system

## Art direction

VestBlock is an editorial-financial technology platform: dark, tactile, precise, and calm under pressure. The visual language uses real material cues—brushed metal, glass, depth, calibrated light, and signal-green accents—rather than decorative neon or template cards.

## Tokens

- Ink: `#090a08` for the field and `#11130f` for command surfaces.
- Paper: `#f3efe6` for primary type and `#c7c5bd` for readable supporting copy.
- Signal: `#b7ff3c` for action, active state, and verified-system indicators only.
- Muted: `#8f9189` and `#666b60` for metadata; never use muted text for core instructions.
- Borders: white at 10–16% opacity; signal borders at 40–70% only for active or actionable objects.
- Spacing: 4px base rhythm; major sections use `clamp(5rem, 9vw, 8.5rem)` vertical rhythm.
- Radius: small, deliberate corners for controls; large-radius decoration is reserved for orbital geometry.

## Typography

- Display type is tight, high-contrast, and used only for the decision headline or section thesis.
- Body copy stays between 16–21px with a 1.6–1.75 line-height.
- Monospace metadata is uppercase, short, and used to expose system state—not to make ordinary copy look technical.
- Keep one clear headline and one primary action per major section.

## Motion

- The hero owns the main motion idea: a single scroll-driven, material-rich VB object.
- Body motion is progressive reveal and subtle hover feedback; no perpetual card choreography.
- Scroll progress controls depth, camera tilt, grid travel, and the material sheen as one composed timeline.
- Reduced-motion mode removes transforms and looping cues while preserving hierarchy and content.

## 3D scene rules

- The actual VestBlock monogram is the focal object.
- Depth is communicated with offset faces, bevel-like edge separation, reflections, shadow, controlled rings, and a fixed coordinate system.
- Callouts name Capital, Deals, and Opportunity as meaningful states; they are not random orbiting labels.
- Keep one focal object, one light language, and one active signal at a time.

## Responsive and accessibility rules

- Compose the mobile scene independently; do not merely scale the desktop canvas.
- Keep the primary CTA reachable within the first two screens.
- Preserve readable captions and labels at 390px and 430px widths.
- Every interactive lane has a keyboard focus state and an accessible label.
- Never rely on color or motion alone to communicate a selected state.
- Keep the page free of horizontal overflow and layout shift.
