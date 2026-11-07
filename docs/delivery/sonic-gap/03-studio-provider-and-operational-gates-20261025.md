# SONIC Gap Lane C — Studio UI, provider, saved operations and release evidence

**Canonical inspected:** `ac78ff7737c95aa1b29b679d2b8ede57e5dfcae4` on `feat/servicedesk-v4-reconciled-qa-shell-20261012` (2026-10-25, read-only). **F08 combined source draft:** [#841](https://github.com/SaamVR/ServiceDesk/pull/841), SHA `25ca21486d9f735fceaf9b52691e2ba561224416`, not integrated. The current canonical is newer than the F08 review base; do not advertise old mergeability or exact-head tests against the new canonical until Production revalidates.

## Already implemented building blocks in canonical

| Area | Canonical evidence | Classification and limit |
|---|---|---|
| Protected AI Studio staff route | `src/app/app/[workspace]/automations/ai-studio/page.tsx` | **BUILT_CANONICAL_COMPONENT** — route exists, not verified as released/live |
| Studio shell and record-focused workbench | `src/features/operations/AiStudioWorkspace.tsx`, `AiStudioWorkbench.tsx`, `ai-studio-records.ts` | **BUILT_CANONICAL_COMPONENT** — source supports authorization and preview UX; not real two-owner browser acceptance |
| Model transports and feature flags | `src/server/ai/runtime-config.ts`, `model-transport.ts`, `provider-gate.ts`, `model-recovery.ts` | **BUILT_CANONICAL_COMPONENT** — opt-in, strict origin/key/model/timeout; config does not prove commercial eligibility or a paid response |
| Owner diagnostic | `src/server/ai/owner-provider-connection-test.ts` | **BUILT_CANONICAL_COMPONENT** — explicit owner synthetic probe can call permitted provider, not evidence it has been successfully run in hosted V4 |
| Owner workday fallback and metrics | `src/server/ai/owner-workday-priorities.ts`, `owner-operations-brief.ts`, `owner-assistant.ts` | **BUILT_CANONICAL_COMPONENT** — safe saved-review fallbacks, incomplete real merchant acceptance |
| Versioned workflow core and starter draft catalog | `src/contracts/workflow-rules.ts`, `src/server/workflows/engine.ts`, `src/server/ai/owner-starter-batch.ts`; merged PRs #168/#171/#172 | **BUILT_CANONICAL_COMPONENT** — five supported events, three actions and 27 draft recipes; does not mean 72 live workflows |
| Existing provider/outbox dispatch infrastructure | `src/server/integrations/outbox/**`, `src/server/ai/action-audit.ts` | **BUILT_CANONICAL_COMPONENT** — policy and transport contracts, not real customer send/provider callback success |

## Partial Studio UI branches requiring Production-owned integration decision

| Reference | Verified audit state | Action |
|---|---|---|
| [Draft PR #631](https://github.com/SaamVR/ServiceDesk/pull/631) | Open/draft/unmerged at audit; accessible searchable record picker source | Compare with current Studio workbench and decide merge/supersede after overlap/conflict review |
| [Draft PR #633](https://github.com/SaamVR/ServiceDesk/pull/633) | Open/draft/unmerged; saved workflow execution inspector source | Review bounded receipt correctness and browser integration; don't claim live inspector |
| [Draft PR #645](https://github.com/SaamVR/ServiceDesk/pull/645) | Open/draft/unmerged; quote-review source safety and cancellation | Review current canonical guard equivalence and stale quotation rejection |
| [PR #642](https://github.com/SaamVR/ServiceDesk/pull/642) | Closed but **not merged**; owner model diagnostics | Compare contained commits with canonical; closure by itself does not prove integration |
| [Draft PR #841](https://github.com/SaamVR/ServiceDesk/pull/841) | Open/draft/unmerged; frozen seven feature bundles plus handoff | Production chooses consolidated **or** sequential merge, not both |

Some legacy Studio work may already be present independently in canonical; matching filenames and UI screenshots do not prove every draft enhancement was merged. Production must use blob/commit and route tests, and document `ALREADY_INTEGRATED`/`SUPERSEDED`/`MERGE`/`DEFER` for each.

## Provider and live-operations acceptance gaps

1. **Two-owner tenant security P02** ([#818](https://github.com/SaamVR/ServiceDesk/issues/818)): unresolved, including `servicedesk_default_branch(uuid)` cross-tenant metadata disclosure in installed DB, approved migration 0065 absent in last live evidence, real OWNER-A and OWNER-B sessions, signed-in browser app; no new live probe is claimed by this report.
2. **Service catalog and quote acceptance P03–P04** ([#819](https://github.com/SaamVR/ServiceDesk/issues/819), [#820](https://github.com/SaamVR/ServiceDesk/issues/820)): last verified DB inventory had 0 catalog services, 0 price books and 0 quotes. The AI quote module cannot demonstrate merchant value without approved real catalog and quotes. Live inventory may have changed; new Production readback required.
3. **Durable accepted-quote/replay P05** ([#821](https://github.com/SaamVR/ServiceDesk/issues/821), [#199](https://github.com/SaamVR/ServiceDesk/issues/199)): crash between accepted quote transaction and best-effort automation processing must be closed with committed journal/worker before claiming hands-off reliability.
4. **Crew/QA/recurrence P06** ([#822](https://github.com/SaamVR/ServiceDesk/issues/822)): saved proof, app route readback, collision and media privacy; a suggestion is not a confirmed assigned team.
5. **Invoice/payment P07** ([#823](https://github.com/SaamVR/ServiceDesk/issues/823)): real settled ledger and approved sandbox only, never infer charge from AI.
6. **AI Studio/provider P08** ([#824](https://github.com/SaamVR/ServiceDesk/issues/824), [#621](https://github.com/SaamVR/ServiceDesk/issues/621)): controlled dedicated commercial API/provider option and budget in deployment secret store, explicit signed-in fictional owner single inference, latency/cancellation/timeout/denial, no OAuth-token reuse for paid multi-tenant.
7. **Messaging/calendar P09** ([#825](https://github.com/SaamVR/ServiceDesk/issues/825)): consent/opt-out and customer identity recheck, configured sandbox/provider receipt, idempotent queued/outbox retry controls.
8. **Platform monitoring P10** ([#826](https://github.com/SaamVR/ServiceDesk/issues/826)): quota counters separate from actual token spend and billing, dependable job health, backup and rate alerts.
9. **Acceptance/release P11–P12** ([#827](https://github.com/SaamVR/ServiceDesk/issues/827), [#828](https://github.com/SaamVR/ServiceDesk/issues/828)): two actual isolated merchants, request→priced quote→confirmed rule→scheduled visit→QA→invoice/ledger receipts, final explicit go/no-go and rollback.

## Test truth and provenance

- Frozen combined source PR #841 reported 769 test files / 3,800 tests and typecheck/lint/build success at exact SHA **25ca2148**. This is *G0 source*. Canonical may differ; do not copy that success as the newer canonical's runtime acceptance.
- Last verified P02 owner/database state is an earlier **read-only** snapshot, not a current query from this lane.
- No controlled paid model call, real customer send, real staging owner acceptance, schema mutation, financial action, deployment, canonical or `main` merge took place during this audit.
- The original roadmap remains `PARTIAL_FEATURE` for complete end-to-end AI-01–AI-14 even though multiple foundational modules are built.
