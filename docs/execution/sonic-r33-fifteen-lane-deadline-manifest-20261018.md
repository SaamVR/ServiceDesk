# ServiceDesk V4 / SONIC-DEADLINE R33: 15-lane staffed capacity manifest
Date: 2026-10-18. Pinned source 4f4c90cd4c3a520dc199dcf29bb524516f40a088. **This is an ownership/dispatch manifest, not proof that 15 separate human or AI agents have been launched.** A GPT session may own multiple disjoint branches. An independent critic owns separate tests/branch. Preserve other concurrently authored work.

## Goal
Ship a real, reviewable, AI-first workflow OS in 3–6 substantial, non-overlapping code slices per wave. Frontload owner-facing inference reliability, trusted persisted business facts, typed rule authoring, and real workflow event integrity. No fake successful executions, automatic provider sends, hidden tenant enrollment, real charges, or product UI pretending source CI proves merchant completion.

## 15 permanently named lanes with exclusive path ownership
| ID | Specialty | Exclusive primary paths / outcome | Status R33 |
| --- | --- | --- | --- |
| L01 | AI provider | `src/server/ai/runtime-config.ts`, `model-transport.ts`, `fetch-transport.ts` – latency/budgets, commercial adapter | Reserve; prior #647 merged |
| L02 | AI Intake Copilot | `src/server/ai/request-brief.ts`, `tests/ai/r33-request-brief-state.test.ts` – saved-record and revoked-session revalidation | ACTIVE |
| L03 | AI Quote/Price Review | `src/server/ai/quote-review.ts`, `quote-review-safety.ts` – credible money/validity facts | HELD: existing #645 owns |
| L04 | AI Rule Compiler | NEW `src/server/ai/workflow-draft-proposal.ts`, `tests/ai/r33-workflow-draft.test.ts` – typed human-reviewed allowlisted proposals | ACTIVE |
| L05 | AI Owner Intelligence | `src/server/ai/owner-assistant.ts`, `tests/ai/owner-assistant.test.ts` – real count/range accuracy | ACTIVE |
| L06 | AI Dispatch | NEW dispatch proposal builder and tests, source-scoped | NEXT WAVE |
| L07 | AI Field QA | NEW photo/checklist source evidence evaluation, consent guard | NEXT WAVE |
| L08 | Core Workflow Truth | `src/server/workflows/engine.ts`, `tests/domain/v2-workflow-engine.test.ts` – event shape and provenance | ACTIVE |
| L09 | Durable Journal/Jobs | `src/server/jobs/**`, `src/server/workflows/customer-quote-source-recovery.ts`, PG17 tests | Reserve; migration 0063 still not applied |
| L10 | WhatsApp + Email | `src/server/integrations/email/**`, `whatsapp/**`, provider tests | NEXT WAVE |
| L11 | Finance + Stripe | `src/server/integrations/payments/**`, invoices and ledger | NEXT WAVE |
| L12 | Calendar + Dispatch | `src/server/integrations/google-calendar/**`, provider tests | NEXT WAVE |
| L13 | Product UX / AI Studio | `src/features/**`, `src/app/**`, `tests/e2e/**` | HELD: owner chat PRs #631/#633/#650/#645 |
| L14 | **INDEPENDENT CRITIC** | Separate branch: adversarial `tests/domain/r33-critic-*.test.ts`, `docs/control-tower/critic/**`; no production source edits | ACTIVE after candidates |
| L15 | Integrator & Release Guardian | Coordinator-owned `docs/execution/**`, manifest/ledger, GitHub sequential merge, exact-head RC and connected staging acceptance | ACTIVE |

## Deadline-mode operating constraints
- **Effective lanes ≠ launched workers.** In this chat execute multiple independently committed GitHub branches. Other chats' draft PRs remain reserved: #631, #633, #645, #650. No branch force pushes, stale-base merges or UI refactors here.
- **P0 evidence, then velocity.** Each active lane delivers 2–4 related behavior slices: implementation + safety negatives + tests + evidence, not a decorative UI card. Close an existing blocker first where source already exists.
- **Budget calls.** One coherent tree commit per lane, PR auto checks/focused test results; avoid redundant manual actions runs. Merge only when exact HEAD CI PASS, critic and parity checks PASS, and latest canonical branch is reconciled.
- **Use GPT Runtime-first / connected GitHub for source**; no remote device/SSH or self-hosted runner. Do not use GitHub Actions as a substitute for local validation without owner authorization; ordinary pre-existing PR CI is accepted source evidence.
- **Critic veto**: review malformed input, actor revocation, tenant ID drift, double-processing, adversarial model proposals, forged saved counts and financial claims. Critic's tests merge into candidate only after producer repairs failures.
- **Staging blocker**: no trusted merchant acceptance until authorized migrations through 0065, two fictional OWNER sessions and actual request→quote→accepted→workflow→invoice durable readback. Samai gateway success is synthetic-only and personal OAuth is not a general commercial SaaS provider.
- **Rollback & telemetry**: no production deploy, DB mutation, customer message or payment. Track attempts/timeout receipts redacted. No success before host confirms.

## Next waves: activate based on disjoint ownership and real dependencies
- R33 A: L02 request state, L04 typed draft compiler, L05 owner metric truth, L08 event input integrity, L14 critic.
- R33 B: L06 dispatch + L07 QA + L10 consent/delivery + L11 invoice anomalies + L14 critic.
- R33 C: L01 provider policy & key eligibility, L03 quote after #645, L09 journal replay, L12 Calendar proof, L13 integrator-owned UX reconciliation, L14 critic.
- Final: L15 must capture exact SHA CI, signed-in two-tenant proof, staging backend/proxy/config, and no-fabrication ready state. No automatic promotion.

## Lane exit contract
PR URL, source SHA, exact paths owned, tested behaviors and regression negatives, exact test/build run conclusion (or BLOCKED), critic recommendation, actual deployed/provider/merchant proof separately labeled, and next actionable dependency. Do not label merely authored PRs as integrated.
