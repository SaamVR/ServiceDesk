# ServiceDesk R40 — SONIC Deadline Team: 24-lane ownership and high-yield runtime packet
Date: 2026-10-18 | Canonical development branch: `feat/servicedesk-v4-reconciled-qa-shell-20261012` | Observed source `ce1d7977083d1f0c52132d0ea8eee221e016c1f3`

## Truth boundary and deadline operating mode
A **lane** is an explicitly owned engineering workstream, not an assertion that 24 independent workers have been activated. In a single GPT runtime, concurrent code branches, batched read-only inspections, sequential source writes and GitHub CI give actual parallelizable work; long-running work cannot outlive the turn unless a supported scheduled task is used. Never invent real tenant/provider acceptance, live Stripe/WhatsApp receipts, SQL migrations or deployed browser checks.

R40 priority: **AI correctness and safe automation that can be wired to actual saved business journeys**. Queue review, real UI, and existing CRITIC veto are first-class features, not decorations. Keep provider ingress/price/payment/booking truth authoritative in Supabase.

## 24 specialist lanes in six practical teams

| Team | Lane | Work and exclusive primary source domain | Activation |
| --- | --- | --- | --- |
| AI Runtime | A01 Gateway transport | `src/server/ai/model-transport.ts`, gateway timeouts/bounded retries; no personal-token commercial expansion | reserve |
| AI Runtime | A02 Provider evidence | `provider-gate.ts`, `owner-provider-connection-test.ts`, synthetic-vs-owner evidence | reserve |
| AI Runtime | A03 AI orchestration | `guarded-orchestrator.ts`, `configured-service.ts`, mixed tool quarantine | **R40 active #732** |
| AI Runtime | A04 Knowledge retrieval | `catalog-knowledge.ts`, allowed source/citation identity | **R40 delivered #734** |
| AI Runtime | A05 Request/Intake | `request-brief.ts`, `request-review-checks.ts`, request version/tenant authority | reserve |
| AI Runtime | A06 Customer reply | `reply-safety.ts`, safe drafts/consent/delivery | reserve, frontend owns active UI |
| Agents | B07 AI workflow compiler | `authorized-workflow-suggestion.ts`, typed draft/preview | reserved: open owner UX #689 and AI #716 |
| Agents | B08 Automation catalog | `automation-template-simulation.ts`, 27 preset applicability and saved version confirmation | reserve |
| Agents | B09 Owner intelligence | `owner-workday-priorities.ts`, saved queue priorities | reserve |
| Agents | B10 Finance review | `invoice-exception-review.ts`, saved ledger truth | **R40 delivered #733** |
| Agents | B11 Dispatch planning | `src/features/dispatch/**`, crew collision, actual capacity | reserve; ownership must reconcile other chats |
| Agents | B12 Field quality | `visit-qa-assessment.ts`, saved checklist/incident controls | reserve; UI field QA another chat |
| Core & Data | C13 Domain events | `src/server/workflows/engine.ts`, sourceEventId/idempotency | reserve |
| Core & Data | C14 Jobs/lease | `src/server/jobs/**`, recovery worker and DLQ | reserve |
| Core & Data | C15 Tenant security | `src/domain/**` and approved schema/pg17 tests | reserve; migrations 0063-0065 approval-gated |
| Core & Data | C16 Pricing and quotes | Domain quote and accepted-quote bridge, authoritative amount/approval | reserve |
| Connectors | D17 Omnichannel | `src/server/integrations/whatsapp/**`, email status and consent | reserve |
| Connectors | D18 Calendar | `src/server/integrations/google-calendar/**`, saved event receipt | reserve |
| Connectors | D19 Payments | `src/server/integrations/payments/**`, Stripe sandbox and ledger proof | reserve |
| Connectors | D20 n8n & webhook | `src/server/integrations/n8n/**`, webhook idempotency/handoff | reserve |
| Product | E21 AI Studio UX | `src/features/operations/**`, `src/app/**` | **separately owned open #631/#633/#650/#661/#662/#689** |
| Product | E22 Field/mobile UX | `src/features/quality/**`, dispatch, visit route/browser QA | separately owned |
| Governance | F23 Independent critic | Separate critic branch, owned negative test files and veto docs; never approve authored code alone | **R40 active #735** |
| Governance | F24 Integrator/release | Coordinator, exact-HEAD CI, PG17, owner browser proof, signed-in two-tenant acceptance | active |

## Parallel workflow — no conflict, no documentation-only stopping

1. Re-read canonical SHA, integration run, all current non-draft/draft PRs. Verify ownership. Block lanes touching another chat's paths.
2. Select 3–6 disjoint READY lanes and deliver a real feature + negative/positive tests per lane. Batch GitHub reads; write each branch independently. Use GPT Runtime or GitHub API, never a desktop unless technically necessary.
3. Critic F23 reads candidate and writes separate adversarial tests; producer implements necessary fixes, critic merges into the candidate. Cross-check whether an upstream guarded result is overwritten downstream (R40 found this in configured-service).
4. Run one focused test per lane plus the existing automatic canonical PR checks. Inspect logs on failures. Avoid redundant full/manual GitHub Actions, and never call queued/running checks PASS.
5. Only merge candidate after its **latest exact commit SHA** is verified green with critic and parity. Release guardian sequentially merges and validates canonical full source/Chrome plus PG17. Document confidence level: SOURCE_PASS, SYNTHETIC_PROVIDER_VERIFIED, OWNER_AUTHENTICATED, or LIVE_DEPLOYED separately.
6. Escalate when requires operator action: isolated V4 deployment, staging migration 0063–0065 approval, two-owner tenant UAT, commercial model credential/license, provider webhooks and real billing. No automatic rollout.

## R40 work and measurable next bulk target

- PR #732: AI orchestration mixed tool proposals & configured-service final handover; a safe-looking allowed quote tool MUST NOT survive risk flagged model reply. Critic #735 contributes adversarial model envelope tests.
- PR #733: signed-in finance candidate's source plans cannot silently accept forged invoice/payout claims or a full page labeled complete.
- PR #734: workspace catalog AI retrieval refuses duplicate active code, forged timestamps, ambiguous/hidden service authority.
- Next: merge #732 after combined full CI; reconcile active frontend and automation PRs without shadow copying; stage tests with approved fictional tenants. Then build a **real saved customer request → AI draft → human review → rule preview → approved published action** evidence chain.

## Scorecard per runtime
Actual created/merged PRs and SHAs; accepted tested behaviors; new negative regression checks; independent critic failures/fixes; canonical exact HEAD full RC + PG17 status; provider/end-user deployment proof separated; pending operator approvals. Do not count static recipes, mock documents, fictional data as successful live automations.
