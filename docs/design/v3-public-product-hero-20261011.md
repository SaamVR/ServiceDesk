# ServiceDesk V3 — differentiated public product storytelling

## Verified design observation

Actual Chrome 390px/1440px capture in [public browser Actions #38133580651](https://github.com/SaamVR/ServiceDesk/actions/runs/38133580651) established that Features, Pricing, Integrations and Contact were all presenting an identical four-step operations card. The shared design system was coherent, but the illustrations did not substantiate the page's particular selling proposition.

## New presentation — source-backed and opt-in per route

- **Home:** keeps the existing four-stage `OperationalFlowHero` explaining the overall cleaning journey.
- **Features:** an operations handoff map showing capture/qualification, human-approved pricing, dispatch/field work and collections/quality. No record counts or synthetic customer labels.
- **Pricing:** a visibly **illustrative** move-out cleaning service quote using the existing `moveOutFixture` ($340 total, $85 deposit, $255 balance; 240 + 30 minutes) rather than inventing ServiceDesk subscription prices. The example is explicitly not a live offer or payment record.
- **Integrations:** WhatsApp and Calendar marked verification pending, Payments sandbox only and AI human reviewed. These are capability/release-policy categories, not live provider telemetry. No verified live connectivity is claimed.
- **Contact:** a three-step practical workflow consultation agenda, plus a direct product-tour link. No fake contact form submission or mail delivery claim.

`MarketingShell` accepts an optional `heroStory` discriminator. Only the four relevant `StaticProductPage` variants supply it. Existing Home, Cleaning, Help and legal routes retain the standard operational flow hero. Styling uses scoped responsive CSS and reduced-motion/focus-visible support.

## Acceptance plan and exclusions

- Focused SSR tests prove four distinct landmarks, real fixture values, honest provider uncertainty, contact links and Home fallback.
- Real Chrome public acceptance must assert the **specific hero landmark** at each of 320, 390, 834, 1280 and 1440px, not just a generic h1 and a 200 status. Capture first-fold and mid-page public screenshots with zero horizontal overflow. Verify the complete `pnpm check:rc` on the exact candidate.
- This is **PUBLIC_ONLY**. It does not clear authenticated 8×5 Studio OS visual review, live provider receipts, owner registration migration #75 or owner signoff. Keep AI/provider flags disabled and production resources untouched.

Owner art direction can be further revised after reviewing the actual browser PNGs. Do not mark aesthetic signoff from CI alone.
