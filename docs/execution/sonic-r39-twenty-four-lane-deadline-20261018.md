# SONIC R39 — 24-lane deadline engineering expansion
Date: 2026-10-18 | Repository: SaamVR/ServiceDesk | Initial baseline: 71467e52ad891a0bdf38cf43c27526f415108979

## Operational truth
These are **24 specialist responsibilities in one coordinated engineering program**, not 24 separately launched agents or an asynchronous job. Each may be executed as a disjoint GitHub branch/worktree by the available GPT runtime, with final acceptance from the integrator and independent critic. The prior [R33 15-lane manifest](sonic-r33-fifteen-lane-deadline-manifest-20261018.md) remains authoritative for L01–L15; this packet adds L16–L24. Preserve all teams' active work; inspect current heads before every write.

## Added nine lanes and exclusive ownership
| Lane | Specialized responsibility | Primary source owner | Status / immediate release goal |
| --- | --- | --- | --- |
| **L16** | Persisted visit milestone integrity | `src/server/workflows/verified-visit-completion.ts`, dedicated tests | Implemented #724, critic #726, merged after full/targeted checks |
| **L17** | Outbox receipt and retry truth | `src/server/jobs/outbox-retry.ts`, provider tests | #725 and critic #727, pending exact latest CI at initial capture |
| **L18** | Delivery idempotency and dead-letter accountability | `src/server/jobs/outbox-repository.ts` plus distinct new tests | NEXT: exact claim/ack/retry recovery without duplicate external send |
| **L19** | Aftercare queue and consent completeness | `src/server/ai/aftercare-batch-planner.ts`, AI source tests | #728 merged after source CI: refuse saturated/truncated batch |
| **L20** | AI eval and prompt-injection regression bench | NEW `tests/ai/r39-eval-*`, `docs/engineering/ai/evaluation/**` | NEXT: test corpus for 25s latency, hallucinated prices, unsafe agent tools |
| **L21** | Omnichannel delivery receipts / reply-vs-queued authority | `src/server/ai/owner-inbox-review.ts`, distinct provider contract tests | RESERVED: owner inbox candidate #723; do not overlap |
| **L22** | Pricing/quote policy reliability | `src/server/ai/quote-review.ts`, money proof tests | RESERVED: #645 and pricing owner issue #616 |
| **L23** | Speech and multimodal intake safety | NEW typed voice/photo intent proposals, explicit consent/schema tests | RESERVED: photo classification #706; speech future; no uploaded image-to-provider without authorization |
| **L24** | Merchant operational acceptance and release effectiveness | `scripts/release/**`, exact-HEAD read-only acceptance receipts | NEXT: signed-in fictional OWNER A/B, persisted request→invoice chain, staging migration authorization separate |

**Independent CRITIC-G is L14**, not an additional conversation. Critic uses an independent branch/PR with adversarial tests; source fixes land on the producing lane and the critic PR merges into that candidate before full CI.

## SONIC batch model / handoff contract
1. Refresh exact canonical HEAD and open PRs; avoid overlapping another team's active source. Assign 3–6 independent medium-sized slices with one owner per file; start different branches from one pinned commit. Model-generated plans are proposals, not published/operational workflows.
2. Read real source/contracts first, implement functional source changes with positive + negative tests. Prefer jobs, authenticated AI, persisted source, proof of correct money/provider status over catalog expansion.
3. The independent critic must challenge false saved-state proof, retry duplication, aftercare consent, provider reference leaks, invalid calendar/timezone, owner/branch revocation, client cancellation and unavailable source.
4. CI: use the existing PR checks, *no manual redundant workflow fan-out*. Merge only after **exact candidate** full source tests/TypeScript/lint/build, focused suites where applicable, and critic/parity. Record real job IDs. Perform exactly one combined integration acceptance suite per canonical merged HEAD.
5. Staging/production changes require explicit authorization: no connected Supabase migration, no Render production update, no real customer message/payment, no monetization via personal Samai OAuth.
6. Report at end: added features/branch PRs, critic outcome and repaired defects, exact merged SHA, isolated candidate statuses, actual connected owner UAT evidence or blocker. No claim of independently running 24 parallel agents or autonomous background progress.

## Immediate next branches (after #725)
- L18: isolate outbox duplicate/replay false success with real repository transaction receipts.
- L20: test that model output containing invented prices, confirmed bookings, unsafe tools and prompt injection cannot bypass customer-safe review.
- L24: make a **read-only** merchant exact-chain diagnostic with 2-tenant acceptance; do not install 0063–0065 unless separately approved.

## Product acceptance bar
AI is usable only if an authenticated owner can generate a verified saved-record draft, review source and actions, explicitly approve, and observe durable execution with provider receipt or truthful failure/retry. A successful synthetic Codex gateway response proves the provider, **not** a released multi-tenant commercial AI agent. All external sends/charges remain gated by supported provider authorization and deliberate business permissions.
