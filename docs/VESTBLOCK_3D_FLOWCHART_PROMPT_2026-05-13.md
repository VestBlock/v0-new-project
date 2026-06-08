# VestBlock 3D Flowchart Prompt

Last updated: 2026-05-13

## Goal

Create a futuristic, hyper-realistic, premium 3D flowchart asset for VestBlock that visualizes the full service ecosystem without looking like a flat SaaS diagram.

This asset should feel like:

- a luxury operating system interface
- a cinematic product explainer still
- a 3D network map with depth, glow, glass, and metallic detail
- a serious fintech / proptech / AI infrastructure brand

## Service Map To Visualize

Use these as the visible service nodes:

- VestBlock
- DealVault
- Search Visibility Service
- AI Receptionist & Website Services
- Business Funding Eligibility
- Business Funding Prep Plan
- Business Setup for Funding & Grants
- Funding & Business Credit Prep Reviews
- Small Business Grants
- Spanish Business Funding
- Real Estate Funding
- Sell Property
- AI Credit Analysis

Use these as supporting infrastructure nodes or secondary orbit labels:

- Smart Contract Proof Layer
- Supabase Data Layer
- Admin Review
- Lead Automation
- Buyer Network
- Lender Network
- PR / SEO Engine
- Payments & Checkout
- Reporting & Daily Intelligence

## Visual Structure

Preferred composition:

- one central hero node for `VestBlock`
- three premium primary service branches:
  - `DealVault`
  - `Search Visibility Service`
  - `AI Receptionist & Website Services`
- one funding and prep cluster:
  - `Business Funding Eligibility`
  - `Business Funding Prep Plan`
  - `Business Setup for Funding & Grants`
  - `Funding & Business Credit Prep Reviews`
  - `Small Business Grants`
  - `Spanish Business Funding`
- one real-estate deal-flow cluster:
  - `Real Estate Funding`
  - `Sell Property`
- one optional support node:
  - `AI Credit Analysis`
- a subtle outer support ring for infrastructure:
  - `Smart Contract Proof Layer`
  - `Supabase Data Layer`
  - `Admin Review`
  - `Lead Automation`
  - `Buyer Network`
  - `Lender Network`
  - `PR / SEO Engine`
  - `Payments & Checkout`
  - `Reporting & Daily Intelligence`

## Master Prompt

```text
Create a futuristic, hyper-realistic 3D flowchart poster for VestBlock, showing the full ecosystem of services as a luxury visual systems map.

Style direction:
premium cinematic 3D interface, ultra-detailed, hyper-real materials, glassmorphism, translucent acrylic panels, polished gunmetal, black chrome, brushed titanium, volumetric lighting, subtle bloom, refracted highlights, holographic edge glow, high-end fintech command-center aesthetic, Apple-level product rendering quality, no cartoon styling, no generic flat SaaS illustration.

Composition:
Build a large central master node labeled VESTBLOCK. From that core, branch into clearly organized clusters with elegant luminous connector paths, depth-rich routing, layered foreground and background elements, floating glass cards, illuminated data rails, and subtle spatial separation between service groups.

Primary cluster nodes:
DEALVAULT
SEARCH VISIBILITY SERVICE
AI RECEPTIONIST & WEBSITE SERVICES

Funding and prep cluster nodes:
BUSINESS FUNDING ELIGIBILITY
BUSINESS FUNDING PREP PLAN
BUSINESS SETUP FOR FUNDING & GRANTS
FUNDING & BUSINESS CREDIT PREP REVIEWS
SMALL BUSINESS GRANTS
SPANISH BUSINESS FUNDING

Real estate cluster nodes:
REAL ESTATE FUNDING
SELL PROPERTY

Optional support node:
AI CREDIT ANALYSIS

Outer infrastructure ring:
SMART CONTRACT PROOF LAYER
SUPABASE DATA LAYER
ADMIN REVIEW
LEAD AUTOMATION
BUYER NETWORK
LENDER NETWORK
PR / SEO ENGINE
PAYMENTS & CHECKOUT
REPORTING & DAILY INTELLIGENCE

Design language:
This should feel like a next-generation financial infrastructure map, combining blockchain trust systems, AI service delivery, funding workflows, lead routing, and premium operations software into one coherent visual story. Use luminous path lines, floating node capsules, layered transparent panels, spatial hierarchy, and elegant directionality so the eye naturally reads from the VestBlock core outward into service categories and support systems.

Color palette:
deep obsidian black background, graphite, smoked glass, silver metal, electric cyan, ice blue, restrained emerald accents, minimal warm highlights only where needed. Avoid purple-heavy palettes. Avoid rainbow gradients. Keep it luxurious and believable.

Lighting:
studio-quality HDR lighting, volumetric fog glow, rim lighting on glass edges, reflective metallic surfaces, subtle caustics, realistic shadows, premium render contrast, controlled glow instead of neon overload.

Camera:
three-quarter perspective, slightly elevated hero view, wide enough to show the whole ecosystem, shallow but readable depth, crisp foreground detail, premium presentation framing, poster-quality composition.

Output behavior:
Make the flowchart readable, organized, and high-end. Prioritize short, bold uppercase labels inside large elegant nodes. Use only minimal supporting microtext. The image should feel like a hero asset for a fintech / proptech / AI company website, investor deck, keynote slide, or campaign page.

Negative constraints:
no messy wire tangles, no cyberpunk clutter, no gaming HUD overload, no cartoon icons, no low-detail infographic look, no flat 2D boxes, no childish gradients, no purple-dominant scene, no illegible tiny text, no random extra services, no people, no mascots, no laptops, no phones, no fake dashboards inside every node.
```

## Cleaner Variant

Use this when the model starts making the chart too busy:

```text
Create a premium 3D service ecosystem diagram for VestBlock with one central VestBlock node and four clean branches: primary services, funding services, real estate services, and support systems. Use hyper-real glass panels, black chrome, silver metal, cyan and ice-blue lighting, volumetric shadows, elegant spacing, and readable uppercase node labels. Make it feel like a luxury fintech infrastructure poster, not a generic flowchart.
```

## Best Practice For Generation

For the cleanest result, use a two-pass workflow:

1. Generate the hero composition with only the main node labels.
2. Add exact small labels and connector annotations in Figma after the image is approved.

If you force too much tiny text into the first render, most image models will make the diagram worse.

## Reference DNA We Pulled In

These GitHub references were cloned locally on 2026-05-13 and used for art direction:

- `xyflow/xyflow`: node-based graph composition and clean flow structure
- `pmndrs/react-three-fiber`: 3D scene composition language
- `pmndrs/drei`: glass, reflections, text, helpers, and polished 3D effects
- `magicuidesign/magicui`: premium motion-heavy UI styling
- `repalash/threepipe`: photorealistic web 3D rendering direction
- `14islands/r3f-scroll-rig`: layered cinematic depth and spatial motion ideas

Local clones:

- `tmp/design-references/xyflow`
- `tmp/design-references/react-three-fiber`
- `tmp/design-references/drei`
- `tmp/design-references/magicui`
- `tmp/design-references/threepipe`
- `tmp/design-references/r3f-scroll-rig`

## Recommended Node Priority

If you need a simplified first asset, keep only these visible labels:

- VESTBLOCK
- DEALVAULT
- SEARCH VISIBILITY
- AI RECEPTIONIST
- BUSINESS FUNDING
- BUSINESS SETUP
- REAL ESTATE FUNDING
- SELL PROPERTY
- SMART CONTRACT PROOF
- LEAD AUTOMATION

## Optional Motion Prompt

If you turn this into a motion asset later, add:

```text
Subtle animated light pulses traveling across connector paths, slow parallax camera drift, soft glow breathing on key service nodes, and restrained depth movement that feels premium and cinematic rather than flashy.
```
