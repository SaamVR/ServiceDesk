# Interactive Operations Theater — Motion Design Spec (2026-11-18)

## Intent
Make the existing live ServiceDesk portfolio compelling to employers and clients by connecting animation to meaningful business events, rather than adding unrelated decorative motion. This is an **interactive fictional demonstration**, not a claim that live AI, provider, billing, or onboarding is accepted.

## Audience and success
A hiring manager or prospective client can select a realistic business exception and observe who acts, what the system prepares, what remains human-controlled, and what records would be needed. First impression must reveal the scenario and a clear CTA without forcing visitors through a long read.

## Design approaches
1. More continuous decorative motion on existing cards: cheap, but weak storytelling and motion fatigue. Rejected.
2. Rebuild homepage with a heavy GSAP/3D environment: high maintenance and risks existing accepted flows. Rejected.
3. **Chosen:** Add one substantial, interactive motion theater below the hero, backed by a pure deterministic state machine; progressive CSS scroll reveals and sourced SVG glyphs only. Do not add a runtime animation dependency. Balance expressive motion with keyboard/reduced-motion/visibility controls.

## User experiences
- Four selectable **fictional** scenarios: new enquiry (happy path), unusual urgent work (quote-review gate), stale calendar availability (dispatch gate), failed outbound message (provider-receipt gate).
- Six-step connected journey from capture → brief → human quote review → dispatch → crew/quality → customer follow-up.
- Start/Pause/Next/Previous/Reset; live event ledger; animated signal traveling along the handoff line; explicit safe stop and human acknowledgment to proceed.
- Customer versus operator perspective switch and channel selector (website, WhatsApp-style, email, voice), both strictly presentation-only.
- Input field for fictional request (180 characters maximum), displayed safely and never persisted or sent.
- Hero anchor to interactive section, additional scroll-based reveal that leaves all content visible if feature unsupported, motion disabled for prefers-reduced-motion, animation paused off-screen or backgrounded, keyboard accessible controls.

## Architecture
- `src/features/product/operations-theater-model.ts`: pure typed state machine, scenarios, step metadata, ledger, guard transitions. No imports from protected SaaS backend. No side effects, network, or random/time-dependent events.
- `src/features/product/OperationsTheater.tsx` and `.module.css`: client-side React controls and staged CSS/SVG motion; native buttons; optional timer controlled by visibility and reduced-motion.
- `src/features/product/AutomationMotionHome.tsx`: imports theater and mounts it after hero strip, retains original timeline, AI studio, 27 real playbooks, integration map and sandbox.
- `tests/e2e/v4-portfolio-operations-theater.test.ts`: deterministic happy path, blocked transition, review gate, reset, view/channel, truthful no-provider outcomes.
- `public/portfolio/icons/`: reuse already vendored original Lucide SVGs and upstream license, no generated/altered icon glyphs.

## Guardrails and non-goals
- No package/lockfile changes, backend/Auth/API/DB writes, external provider calls, secret use, new Render/Vercel services or live payment claims.
- No automated client messages, fake revenue/time savings or simulated receipts presented as real.
- Only deploy exact reviewed SHA to existing Render `srv-dbugfa5g1s2s73bpjne0`; auto-deploy remains disabled; preserve original V3 and non-portfolio page.
- Avoid scroll hijack, trapping scroll, forcing autoplay on reduced-motion devices, or hiding content when JS/scroll API is unavailable.

## Creative critic gate
Veto if animation is disconnected from causality, if a blocked workflow can silently continue, if icon motion obstructs text, if content isn't available by keyboard/reduced-motion, if mobile layout breaks, or if sample data resembles a true provider acceptance receipt. Build and source scope are separate gates from real browser visual QA.

## Reference engineering guidance
- MDN CSS scroll-driven animations: https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Scroll-driven_animations
- Motion accessibility and reduced motion guidance: https://motion.dev/docs/react-accessibility
- GSAP ScrollTrigger performance/accessibility concepts: https://gsap.com/docs/v3/Plugins/ScrollTrigger/
- Source icon assets: https://github.com/lucide-icons/lucide and committed license.
