# ServiceDesk V4 / CLEAN AIR — homepage redesign implementation record

## Source of direction

Owner rejected V3's graphite/dark green palette, bland typography and generic card-stack homepage. Owner supplied an image collage of a white/teal cleaning-service website with photo-led hero, roomy full-width sections, turquoise process background and large testimonial/card margins, and requested the rhythm of their Ezcomo site's presentation. The target is **cleaning-business-first, with a small, intelligible amount of AI/operational technology**, not another dark SaaS product template.

The reference is a composition/style direction only. Do not reuse the reference's Flatiron Maids name, logotype, review ratings, fake customer testimonials or source copy.

## Design decision / visual system

- Canvas: white `#FFFFFF`, porcelain `#F7FBFA` and pale sea-glass `#EAF7F4`. Clean teal `#219D9B` for purposeful section separation, ink `#203638`. Coral `#FA785F` used sparingly for primary conversion actions.
- Type: high-legibility Manrope display and DM Sans body via optional Google-hosted CSS with system fallbacks; no decorative serif headlines or cramped heavy caps. Large editorial headline hierarchy, restrained small operational overlines.
- Photo direction: a naturally lit tidy kitchen and people performing real home cleaning; use free Unsplash editorial imagery, *not* unverifiable photographs of our own employees:
  - Kitchen: Clay Banks, Unsplash free image, https://unsplash.com/photos/modern-white-kitchen-with-stainless-steel-appliances-and-island-7y0DGa1vlXQ
  - Cleaning scene: Dreame Vacuum Cleaner, Unsplash free image, https://unsplash.com/photos/two-women-cleaning-a-modern-living-room-with-vacuum-cleaners-rpwSypUZ7Sk
  - Remote images are decorative photography, not product/owner evidence, and need a controlled licensed/optimized local-asset handoff before final performance release.
- Responsive image masks, bordered system cards, deliberate whitespace, section alternation, context-first operator labels.

## Implemented homepage narrative

1. White, airy photo-led **hero**: “A cleaner way to run your cleaning business.” A small semi-translucent operational enquiry card is explicitly *illustrative* and requires staff review. CTA points to the real public product tour while owner registration is unavailable.
2. Short **clarity strip**: one customer story, human-first AI, connected operations; number labels are stages, not fabricated customer/revenue KPIs.
3. Full-width turquoise **how it works**: request, deterministic quote, staffed dispatch, completion/quality; people-cleaning imagery and a cut-out photo mosaic.
4. White **difference grid**: customer communication, handoffs, pricing integrity, automation assistance; four distinct visual explanations.
5. Distinct dark-teal **AI assistance explainer**: user-selectable Inbox / Scheduling / Follow-ups with real client interaction. It changes only local, labelled example content—no API calls, sends, payments, AI hallucinated authorizations or customer fixtures presented as production evidence. All three paths end at staff decisions.
6. Clean **operations preview**: example request, schedule and quality cards with linked outcomes and a clear sample label; CTA to existing tour.
7. Pale sea-glass **closing**: simple business-first CTA and consultation path.

## Motion, interaction and access

- Micro motion: subtle hero card float, small circular illustration rotation, active AI demo transitions, focus-aware button/CTA hover and tab states.
- All motion is disabled under `prefers-reduced-motion: reduce`. No autoplay videos, scroll hijacking, large GPU WebGL scenes or nonfunctional controls.
- Five-width public Chrome proof includes 320, 390, 834, 1280 and 1440px; validates exact H1, correct illustrative workbench landmark, mobile action target geometry, opened mobile navigation, horizontal overflow and client-side Scheduling tab at two widths.
- `MarketingShell homeEdition` isolates the new design to the root page; routes /features, /pricing, /contact, /integrations, /tour and /auth/sign-in remain intact. Restricted QA owner registration cannot activate public signup CTA.
- All public imagery/photos, service scenarios and metrics must remain correctly labeled. Do not invent reviews, customer counts, cost savings, active provider connection state or AI automation authority.

## Acceptance gates

Must PASS exact-head `pnpm check:rc`, Chrome screenshot proof, code review, owner visual inspection and privacy/default-disabled-feature checks **before** changing the existing Render review deployment branch. This is a visual-review build, not a production-ready connected tenant. Supabase schema migration history, owner authentication QA, provider receipts and 40 authenticated Studio OS screenshots remain separate operations gates.

Pending future design scope: propagate selected bright/clean typography and palette to the 4 product routes, Sign-in, and *only after user accepts direction*, Studio OS. No mass recolor of staff UI at this milestone.
