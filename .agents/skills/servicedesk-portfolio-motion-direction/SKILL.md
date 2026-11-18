---
name: servicedesk-portfolio-motion-direction
description: Create expressive, causally accurate SVG/CSS business-event motion for the standalone ServiceDesk portfolio without breaking production SaaS boundaries. Trigger on any portfolio motion, illustrated action or interaction request.
---

# ServiceDesk Portfolio Motion Direction

**Audience:** design clients, engineering reviewers and hiring managers evaluating a business-automation portfolio.

## Visual grammar
1. Every animated element must signify a trigger, a transfer of responsibility, an explicit human decision, a state confirmation or an explainable recovery. Movement without a business meaning is rejected.
2. One focal event at a time. Use a route/track tied to the actual ordered lifecycle; never let a van/message/icon float between arbitrary places or imply an unverified route.
3. Favor well-spaced editorial typography and clear event hierarchy. The first 10 seconds should communicate WHAT the business does and provide an obvious interactive entry.
4. Easing: short motion (200–350ms) on controls; 450–700ms on state handoffs; 2.5s+ only for user-controlled cinematic playback. Use CSS transform/opacity where feasible; do not animate layout repeatedly or hijack scroll.
5. Reuse original externally sourced SVG icons in `public/portfolio/icons/`; include the original license. Never fabricate a brand mark or mix incoherent icon styles. If a new icon is required, fetch the original from Lucide and verify license/provenance.
6. Animate only a moving packet on its real visual rail or along a confirmed, grounded event connector. A step label must remain visible even while motion is disabled.
7. Support `prefers-reduced-motion`, keyboard and non-hover interactions. Autoplay must stop at human gates and must not progress while hidden or offscreen.
8. Distinguish 'source implemented', 'synthetic demo', 'provider verification pending' and 'live accepted' in plain text. No synthetic event becomes a receipt or KPI.

## Source reference standards
- Scroll progress and native fallback: https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Scroll-driven_animations
- Accessibility and reduced motion: https://motion.dev/docs/react-accessibility
- GSAP ScrollTrigger as optional future tool for more complex timelines (do not add to package without lockfile/controller approval): https://gsap.com/docs/v3/Plugins/ScrollTrigger/
- Authentic vectors: https://github.com/lucide-icons/lucide and retained LICENSE.

## Performance gate
- Every animation cleans up effects/listeners/timers on unmount.
- No required content hidden behind animation when JS is disabled or media feature unsupported.
- No layout thrash through scroll listeners; favor CSS ViewTimeline progressive enhancement and IntersectionObserver only for pause/reveal state.
- Preserve existing Next.js, React, CSS module and public route structure.
