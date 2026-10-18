# ServiceDesk V4 SONIC / R36 — 24-lane AI-first deadline roster
Effective 2026-10-18. Canonical baseline when assigned: `d7be86205f6c8c2e23da548b63c9f1a1cbbfa6ba`.

**Correct interpretation:** 24 named responsibilities are an engineering ownership model, not 24 separately launched autonomous workers. The currently available GPT runtime may coordinate and implement multiple independent candidate branches within one turn. Other developer chats continue to own their actual separate PRs. Deliverable acceptance is exact code + focused tests + full RC + critic, not a lane count.

## Active / reserved lanes
| ID | Ownership | Files / bounded role | Status |
| --- | --- | --- | --- |
| 01 | Provider bridge | model transport/runtime config and credentials; no personal OAuth SaaS entitlement assumption | RESERVE |
| 02 | AI Intake | saved request-grounded briefing and post-provider revalidation | ALREADY MERGED R33 |
| 03 | AI Pricing/Quote | quotes, current version and financial authority | RESERVED existing #645 |
| 04 | AI Rules | typed draft compiler & synthetic previews | ALREADY MERGED |
| 05 | Owner Metrics | verified owner count/window; explainability | ALREADY MERGED |
| 06 | AI Dispatch | safe travel/crew/availability proposals | RESERVED other active lane #681 |
| 07 | Field QA | saved checklists/photo references & review | RESERVED other active lane #682 |
| 08 | Workflow Core | persisted source and rule engine | ALREADY MERGED |
| 09 | Durable Journal | idempotent source event jobs & PG17 recovery | NEXT |
| 10 | WhatsApp | consent, approved templates, genuine delivery receipts | NEXT |
| 11 | Stripe/Finance | saved invoice ledger, charge/refund authority | NEXT |
| 12 | Google Calendar | idempotent event planning, no invented calendar ACKs | NEXT |
| 13 | AI Studio UX | authentic owner browser UX; do not collide with #689/#687/#668/#665/#650 | RESERVED |
| 14 | Independent Critic | own test PR and veto; hidden data/tenant/temporal cases | ACTIVE R36 |
| 15 | Release Integrator | canonical merge/CI/staging release gates | ACTIVE |
| 16 | AI Audit Privacy | `src/server/ai/action-audit.ts`; redacted evidence and bounds | ACTIVE PR #690 |
| 17 | Staff Authorization | `src/server/ai/staff-invocation.ts`; post-model actor/source drift | ACTIVE PR #691 |
| 18 | Owner Provider Probe | `src/server/ai/owner-provider-connection-test.ts`; real ephemeral provider success | ACTIVE PR #694 |
| 19 | Aftercare & Retention | trusted completion, consent, quiet hours, owner-approved reminders | NEXT |
| 20 | AI Evaluation Laboratory | synthetic adversarial prompts, schema conformance, hallucination rate & no live customer text | NEXT |
| 21 | Provider Reliability | retry policy, throttling, redacted latency budgets, expenditure alarms | NEXT |
| 22 | AI Observability | execution/source receipts, explainable provenance, failure queues | NEXT |
| 23 | Multi-tenant Security | isolated OWNER A/B, branch RLS, consent/capability gating | RELEASE BLOCKER |
| 24 | Merchant Acceptance | browser QA exact saved request → quote → visit → invoice, documented real acceptance | RELEASE BLOCKER |

## Deadline operating rhythm
- No repeated broad discovery during a wave: refresh canonical SHA + PRs once; claim disjoint exact paths. Work in **three simultaneous conceptual workstreams**: (A) AI authorization and reliability, (B) operational source automations, (C) independent critic and release.
- Each active code lane must ship a user-relevant behavioral improvement **plus adverse-case tests**. Favor 3–6 tested medium slices over 24 documentation-only placeholders.
- Independent critic lives **inside the same chat as a distinct branch** where tooling permits; actor who changes source must not silently author/declare its own independent test green.
- Keep auth/tenant/source truth and human approval checkpoints for outbound customer messages, refunds, pricing and crew assignment. All source-only capabilities must say exactly that.
- **PR gate**: read actual CI test output, fix failures, merge independent critic to parent, then rerun exact-parent branch CI. Merge candidates sequentially to canonical only after green. Run integrated exact-HEAD Chrome and PG17; report pending if still running.
- **Production gates**: staging migrations 0063–0065 need explicit approval and second-owner actual RLS test; Render R13 is not latest V4. Samai synthetic Codex successful HTTP200 does not itself authorize sharing a personal Codex login across merchants. No production push, SQL migration, customer outreach or payment in this source batch.
- Each runtime's source ledger: delivered PRs + SHAs + actual validation + critic defects found/fixed + blockers + next file ownership. Update GitHub issue #173 and coordinator #644 at useful checkpoints.

## R36 actual contributions
- L16: action-audit privacy and secret redaction PR #690, critic #692.
- L17: saved customer conversation/actor revalidation PR #691, critic #693.
- L18: post-probe current owner and hidden JSON evidence PR #694.
- L15: this roster + sequential review/merge + exact-HEAD source and browser gates.
- R36 next strongest feature batch: L19 aftercare approval reminders, L20 AI evaluation corpus, L21 provider latency/reporting, L09 durable workflow scheduler, with contract-first source testing.
