# ServiceDesk V3 — truthful page titles and gated public indexing

## What changed
Each public product route now publishes its **own** page title, description,
Open Graph summary and Twitter summary. These are taken directly from
`publicProductPageCopy`, the same editorial source that renders each page's
actual h1 and opening paragraph:

- `/features` — cleaning operational workflows and staff outcomes
- `/pricing` — transparent service **quote** pricing rules; explicitly **not**
  invented ServiceDesk SaaS subscription prices
- `/integrations` — provider configuration, sandbox and verification states;
  not a claim that Meta, Google, Stripe, email or AI are all live
- `/contact` — evaluation/walkthrough preparation; not an unverified lead form

`/auth/sign-in`, existing workspace pages and other routes inherit the
site-wide default unless otherwise declared. The default title is
`ServiceDesk AI | Cleaning Operations Workspace`, and specific public titles
are suffixed by ` | ServiceDesk AI`.

## Publication safety

The site now emits `noindex,nofollow` by default, controlled by the
**server-side build/deployment flag**
`SERVICEDESK_PUBLIC_INDEXING_ENABLED=true`. This flag controls only
search engine indexing metadata; it **does not enable signup**, expose staff
records, activate providers, grant authorization or prove production readiness.
Enable indexing **only after** the production-domain/release review and an
approved deployment; redeploy to refresh statically built metadata.

No public canonical URL, social image, subscription plan, payment receipt,
production origin or unverified live provider status is invented.

## Acceptance

- The content-to-metadata relationship and default-off indexing flag are
  regression-tested in `v3-public-route-metadata.test.ts`.
- `pnpm check:rc` must pass on the exact combined SHA.
- The public six-route / five-width real-Chrome proof remains independent
  of authenticated 8×5 staff QA. It cannot replace owner visual acceptance.
- Supabase migration issue #75 and public owner registration are still blocked;
  this SEO work does not alter those gates.
