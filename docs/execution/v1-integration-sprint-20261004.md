# ServiceDesk AI — V1 Integration Sprint

Date: 2026-10-04
Status: ACTIVE
Coordinator: GPT-5.6 Sol High

## Why the workflow changes now

The project has accumulated broad implementation on three divergent worker branches, while the conservative integration branch contains only narrow evidence-backed closures.

Current worker branch breadth observed:
- Core: 44 TypeScript/SQL implementation+test files in owned source/test surfaces, plus migrations.
- Connectors/AI: 193 owned TypeScript files across WhatsApp, Calendar, Payments, Email, Webhooks/n8n, Recovery, Subscription and AI.
- Product/UI: 119 owned TypeScript/TSX files across public/business/app/customer/crew routes and Product view-models.

Branch divergence from the coordinator integration branch before this sprint:
- Core: 76 commits ahead / 73 behind.
- Connectors/AI: 338 commits ahead / 73 behind.
- Product/UI: 243 commits ahead / 73 behind.

Continuing to spend one worker run on one edge-case hardening slice is therefore lower value than assembling and completing the missing V1 authoritative seams.

## Full unverified RC candidate

Created:
- branch: `rc/servicedesk-v1-unverified-20261004`
- current RC HEAD: `fb222d26132897561ae2eed3d6f5aa91475bf591`

Construction:
1. Base = coordinator integration `39ee4f855e20efc7df95e72d0c9e575ad6f8ef15`
2. Core-owned snapshot overlay commit = `011190cb141d6020a5996ff3313d81aa1fc3339e`
3. Connector/AI-owned snapshot overlay commit = `a644cca7b95702cac85dac25368146d2e8d6048f`
4. Product/UI-owned snapshot overlay commit = `fb222d26132897561ae2eed3d6f5aa91475bf591`

Excluded from blind overlay:
- coordinator-owned contracts/package/lockfile/deployment/shared barrels;
- Connector `src/server/api-handlers/index.ts`;
- worker planning docs.

This RC is explicitly UNVERIFIED. It is a development/integration candidate, not a release claim.

## V1 roadmap reality

### Already broad in source
- contracts/foundation;
- tenancy/auth/customer/request primitives;
- deterministic quote engine/versioning/approval;
- capacity/slot holds/visit scheduling;
- ledger/outbox/attention primitives;
- WhatsApp inbound/outbound/status/media/template/recovery;
- Google Calendar OAuth/freebusy/sync/reconciliation;
- Payment checkout/webhook/recovery/provider proof scaffolding;
- Email;
- signed webhooks + n8n;
- provider recovery scheduler/lease/receipt;
- AI extraction/knowledge/guarded orchestration/model recovery;
- subscription connector;
- broad public/business/app/customer/crew Product surface;
- reporting/onboarding/settings/quality/recovery/billing/checkout/CRM view-models.

### Critical authoritative V1 seams still missing or incomplete

1. E02 — shared DTO/property read + composed request/quote server entrypoints.
2. E03 — atomic verified payment → ledger/invoice/visit/outbox/review core transaction.
3. E04 — durable outbox claim/lease/retry worker under `src/server/jobs/**`.
4. E05 — durable inbox/message delivery read model + human takeover command + business-authorized outbound enqueue.
5. E06 — authorized crew visit transitions + field evidence/checklist persistence.
6. E07 — durable recurrence generation/pause/resume/skip commands.
7. E08 — invoice/manual payment + quality/attention lifecycle persistence.
8. E09 — authoritative reporting/admin/settings/platform-billing/usage snapshots and commands.
9. E10 — full integrated journey, real DB/RLS/concurrency proof, provider proof, browser acceptance and operations packet.

## New priority rule

Until the critical seams above are closed:
- STOP spending primary worker capacity on cosmetic Product refinements.
- STOP broadening provider adapters that already have substantial source coverage.
- STOP micro-hardening isolated edge cases unless they block an active authoritative seam.
- PRIORITIZE server composition, persistence, transactionality, integration compatibility and end-to-end data flow.

## Lane missions

### Worker 1 — Authoritative Core
Primary objective:
Close E02 → E04 first, then E05/E06.

The Core lane should create actual missing server/repository/job seams rather than continue isolated validation-only patches.

### Worker 2 — Bridge/Compatibility
Primary objective:
Make existing provider/AI implementation compatible with the accepted Core entrypoints and identify only the minimum bridge changes required by E03–E05.

Do not spend the main run adding another provider feature family while existing families are not connected to authoritative Core.

### Worker 3 — Server-backed Product
Primary objective:
Convert existing fixture/preview Product surfaces to accepted server snapshot/command boundaries as Core contracts become available.

Do not expand new UI pages. Existing V1 page coverage is already broad enough.

### Coordinator
Primary objective:
- keep `rc/servicedesk-v1-unverified-20261004` current;
- own shared contracts/barrels/composition;
- resolve cross-lane conflicts;
- integrate returned work immediately;
- maintain honest evidence labels;
- run canonical catch-up as soon as package/network access is restored.

## Runtime strategy

A normal chat prompt cannot guarantee a 20-minute wall-clock run. Worker completion must be judged by deliverables, not elapsed time.

For genuinely sustained autonomous work, use ChatGPT Work mode for worker lanes when available. Standard GPT-5.5 chat can use large backlogs and quotas, but the prompt cannot force a minimum execution duration.

During the current GPT Runtime DNS outage:
- package-free pure TypeScript work may use outage mode;
- dependency-heavy DB/React/Next/provider proof stays explicitly blocked;
- the RC candidate may continue as UNVERIFIED source integration.

## Immediate next milestone

V1-INT-1:
Full RC static compatibility audit + shared-contract gap report.

V1-INT-2:
Core E02 server composition:
- PropertyDTO/read;
- request facade;
- request+quote+capacity composition;
- server-only entrypoints.

V1-INT-3:
Atomic verified payment core boundary.

V1-INT-4:
Durable outbox worker claim/lease/retry.

This sequence delivers far more V1 completion value than another round of isolated hardening.
