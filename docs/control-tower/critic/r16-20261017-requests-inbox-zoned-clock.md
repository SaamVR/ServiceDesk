# V4 R16 — Independent Critic: Requests and Inbox clock integrity

Date: 2026-10-17 UTC. Role: independent **logical** Critic lane inside the same engineering ChatGPT conversation (not an autonomous agent or human reviewer). Pinned controller baseline: `c9be3b41d646175f3df59bee4cf828d27284cd33`.

## Candidates (disjoint paths)
- [#575](https://github.com/SaamVR/ServiceDesk/pull/575) R16A Requests; pinned PR head `6871480a6b5a325f75d3ad7447d022a8b23385a6`. Files: `cleaning-request-next-steps.ts` and its focused Vitest suite.
- [#576](https://github.com/SaamVR/ServiceDesk/pull/576) R16B Inbox; pinned PR head `35079f2c99f416a00e7aa5c80cc0590ca93d786d`. Files: `inbox-delivery-diagnostics.ts` and its focused Vitest suite.
- No shared source paths and no conflict with the previously completed R15A/B/C/D money, sending or customer-acceptance integration. R15E separate unmerged source candidate remains on hold and is not used as a base.

## Source behavior and adversarial findings
**#575 — Staff request readiness:** Original product checklist used `Date.parse` on server read time and persisted quote expiry. It could count an offer as financially complete while treating an unzoned locale-dependent expiry as future. Candidate reuses canonical R15D `trustedQuoteInstant` and fails closed on invalid/absent saved OFFER expiry or the explicit `asOf` snapshot clock for APPROVED and SENT. Positive cases: strictly future UTC and equivalent explicit +03:00 offset; ACCEPTED historical quotes remain accepted even after offer validity elapsed. Negative cases: date-only, ISO without offset, invalid offset, malformed read time and invalid monetary source. Scope: staff-facing checklist only; server RPC/tenant membership remains authoritative.

**#576 — Inbox delivery health:** Original client parser accepted `Date.parse("2026-10-11")` and similar locale-dependent `generatedAt` strings. Connected source code `src/server/integrations/whatsapp/delivery-triage.ts` emits `now.toISOString()` (UTC ISO), so the new zoned requirement is compatible with normal server output. Added malformed date-only/unzoned/offset negatives, valid zoned and leap-day positives. During Critic review, Date.parse normalization of impossible Feb 30/Apr 31 and 24:00 was caught and the candidate was corrected with calendar/leap-year bounds and additional regression tests. Client display validation does not prove provider acceptance and cannot replace server-side branch/tenant authorization.

## R16C follow-up discovered by Critic
The shared R15D quote-clock parser used by SEND and ACCEPT accepted JavaScript-normalized invalid days (e.g., February 30) and only admitted up to 3 fractional digits, whereas PostgreSQL may serialize 6. A third independent, disjoint code path was added: [#578](https://github.com/SaamVR/ServiceDesk/pull/578) at immutable head `9015a1025702a4f517f5e142c4495c8b5fa900a1`, changing only `quote-validity-clock.ts` and its focused SEND/ACCEPT suite. It validates civil calendar/leap day/hour/minute/second before parsing the zoned timestamp, retains legitimate UTC/offset instants and PostgreSQL microseconds, and tests invalid calendar values against both staff SEND and customer ACCEPT boundaries. Its standalone exact-head CI has now passed, while canonical integration and authenticated merchant proof remain unverified.

**Critic negative cases:** invalid Feb 30/Apr 31, non-leap Feb 29, 24:00, minute 60, second 60, month 00 and 13; positive leap Feb 29 and six-digit fractional instants. All three source lanes are disjoint, and no provider/money operation was executed.

## Separate acceptance boundaries
These are source-only defenses. Neither change sends messages, approves quotes, creates workspace rows, modifies Supabase migrations, invokes paid AI, charges payments, deploys Render or merges production main. No connected merchant UAT is claimed. Supabase only has a single workspace and lacks persisted paid quote/visit/invoice/workflow evidence according to current read-only acceptance issue [#487](https://github.com/SaamVR/ServiceDesk/issues/487). Migration 0063 remains absent.

## Independent Critic verdict: SOURCE CONTRACT PASS / OPERATIONS HOLD

**Source-only PASS at exact PR heads** as of 2026-10-17 UTC. Three distinct PR source lanes have all three PR-scoped jobs PASS: mandatory full-source RC; review merge-tree parity; independent Critic CI. Neither source head moved during review.

| Lane | Immutable head | Full source RC | Review parity | Critic CI |
| --- | --- | --- | --- | --- |
| R16A #575 | `6871480a6b5a325f75d3ad7447d022a8b23385a6` | [PASS #39014351668](https://github.com/SaamVR/ServiceDesk/actions/runs/39014351668) | [PASS #39014351642](https://github.com/SaamVR/ServiceDesk/actions/runs/39014351642) | [PASS #39014351666](https://github.com/SaamVR/ServiceDesk/actions/runs/39014351666) |
| R16B #576 | `35079f2c99f416a00e7aa5c80cc0590ca93d786d` | [PASS #39014354822](https://github.com/SaamVR/ServiceDesk/actions/runs/39014354822) | [PASS #39014354682](https://github.com/SaamVR/ServiceDesk/actions/runs/39014354682) | [PASS #39014354630](https://github.com/SaamVR/ServiceDesk/actions/runs/39014354630) |
| R16C #578 | `9015a1025702a4f517f5e142c4495c8b5fa900a1` | [PASS #39014519230](https://github.com/SaamVR/ServiceDesk/actions/runs/39014519230) | [PASS #39014519246](https://github.com/SaamVR/ServiceDesk/actions/runs/39014519246) | [PASS #39014519331](https://github.com/SaamVR/ServiceDesk/actions/runs/39014519331) |

**Failures observed:** 0 CI failures in nine final candidate checks. **Critic catches:** 1 additional substantive defect during review (impossible calendar normalization) plus the observed local-time and fractional precision defects addressed by the source lanes. **Wall elapsed:** full-source R16A ~189 s, R16B ~183 s, R16C ~182 s according to GitHub run timestamps (not billed compute minutes). No device calls and no rebase collisions. Integration commit source and GitHub Actions must be checked independently before controller merge. Canonical full-source/Chrome and PG17 on the newly merged HEAD remain mandatory. Merchant usability and provider acceptance remain HOLD.

## Historical gate checkpoint (superseded by PASS evidence above)
Initial draft recorded full-source jobs pending; subsequent exact-head checks are all PASS as documented above. Independent Critic source-only gate is PASS; authenticated merchant and live provider operational proof remain separately BLOCKED.

CI: [#575 full PR run 39014351668](https://github.com/SaamVR/ServiceDesk/actions/runs/39014351668), [#576 full PR run 39014354822](https://github.com/SaamVR/ServiceDesk/actions/runs/39014354822). Previous canonical full source [39013207194](https://github.com/SaamVR/ServiceDesk/actions/runs/39013207194) and PG17 [39013207189](https://github.com/SaamVR/ServiceDesk/actions/runs/39013207189) were both successful at baseline `c9be3b41d646175f3df59bee4cf828d27284cd33`, not at proposed combined R16.

## Throughput / next improvements
Two coherent nonoverlapping product paths allow concurrent validation; one real Critic issue was detected and corrected during review before source integration. Keep repository runner-cost honest: Actions wall elapsed time is not billed minutes; inspect job timings instead of inventing cost. Do not rerun still-green immutable source SHAs. Merge only after exact-head checks, then invoke both canonical full-source/Chrome and independent PG17 once at the resulting controller SHA. Follow-up source candidate #578 now addresses the observed invalid-calendar risk. Require its own exact-head full-source gate and Critic review before promotion; do not treat authored negative tests as executed proof.
