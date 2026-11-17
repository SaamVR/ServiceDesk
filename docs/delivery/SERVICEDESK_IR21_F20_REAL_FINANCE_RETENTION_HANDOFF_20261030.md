# ServiceDesk IR21 / F20 — owner invoice exception and consented retention review

Date: 2026-10-30
Repository: SaamVR/ServiceDesk
Source-only branch: sonic-integration/ir21-f20-real-finance-retention-20261030

## Parent and source lanes
Reviewed IR20 #914 SHA `4fbc62a16feeb1c08a8dfe7ac0a493ad9b722dfe`.
- `sonic-feature/f20-ledger-exception-invoices-20261030`: F03 two-read owner-only ledger exception explanations accessible in Invoices. Shows bounded diagnostic reason codes, staff corrective steps and exact saved invoice links. No amounts/PII/provider settlement claims, writes or payments.
- `sonic-feature/f20-consented-retention-customers-20261030`: F04 owner/ALL-branch two-read saved visit history, explicit channel opt-in and suppression controls; shows bounded repeat-service vs service-gap (not churn) opportunities and exact authorized Customer/Job links. No email/WhatsApp recipient contact, outreach, autonomous campaign execution or pricing.
- `sonic-critic/f20-finance-retention-safety-20261030`: independent denial, lifecycle and unsafe-side-effect tests.
- Integrator owns `F20OwnerSourceReviewGate`, two entrypoint page additions, exact 7-blob source manifest `sonic-ir21-f20-finance-retention-source-lock-20261030.json` and separate exact-source critic.

This is genuine on-screen integration, not standalone unused helper code. Existing `OperationalProductRoute.tsx` and historical frozen source-lock artifacts remain unchanged.

## Release and test policy
Source-only draft; not a live accepted finance/retention service. P02 #818 remains OPEN and P03 #819 QUEUED/blocked. Separate release owner must explicitly authorize exact staging guard, two-tenant real owner UAT and P03 real catalog/rates. No Auth/DB/SQL writes, Vercel preview/project/deploy, provider send, AI spend, payment/refund, actual outreach/booking or canonical/main merge. Real F04 customer retention requires send-time consent, identity, opt-out and quiet-hours check independently before any future approved message action.

One focused F20 gate: four new feature/integration/critic test files + TypeScript + changed-file ESLint + Next source build. Do not repeat all historical 3,800+ tests in Feature Factory. Production readiness separately owns one consolidated exact-source PG17/Chrome/security approval gate after authorization. Do not merge each stacked PR individually and also the final composite.
