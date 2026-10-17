# R17E Independent Critic — Authoritative recurrence snapshot proof (#552)

**Date:** 2026-10-17 (UTC). **Independent logical Critic lane**, same controller conversation; this does not represent a separate running human or agent. **Canonical start:** `a37323f1019b866bf7b87ec4a71275c937a3121f`. **Core candidate:** [PR #590](https://github.com/SaamVR/ServiceDesk/pull/590), source/test head `94cdc4ac59f1b794d6d134fdf28bf4c0551261c8`.

## Defect and practical merchant consequence

Existing `recurrenceRuleFromRpc` in `src/server/core/conversation-postgres.ts` used `Number(field(...) ?? 0)` for `generatedOccurrences` and `version`, and `String(field(...))` for identities/dates/timezone/status. A damaged SQL snapshot could appear as legitimate zero generated visits or version 0, or expose the literal text `undefined` as if it came from saved scheduling data. This directly risks misleading staff recurrence visibility; it is not evidence that any actual customer appointment was generated or missed.

Candidate checks saved required fields, supported frequency/status and IANA-valid timezone, SQL date and TIME formats, nonnegative integer `generatedOccurrences`, strictly positive integer `version`, nullable strictly positive `maxOccurrences`, and offset-aware saved timestamps. Rejecting any corrupted row routes the full read through `SNAPSHOT_RPC_ERROR_MALFORMED`, not an invented empty schedule. Foreign-tenant rules retain `SNAPSHOT_RPC_SCOPE_MISMATCH`.

## Installed schema checked read-only (project cpmmgivhlkfbiwzhlcey)

`public.recurrence_rules` has UUID required identifiers, `recurrence_frequency` enum, `time without time zone` required, `date` required/optional, `generated_occurrences integer NOT NULL DEFAULT 0`, `version bigint NOT NULL DEFAULT 1`, `max_occurrences integer NULL`, `created_at/updated_at timestamptz NOT NULL`. Constraints include `generated_occurrences >= 0`, `version > 0`, `max_occurrences > 0` when nonnull, and `ends_on >= starts_on` when nonnull. The candidate deliberately checks strict positive version, unlike the old coercion. No connected SQL change occurred.

## Adversarial matrix / Critic challenge

- **Valid saved evidence:** zero generated occurrences with real version 1; `09:30`, `09:30:00` and `09:30:00.123456`; leap year February 29; nullable end, next occurrence and maximum.
- **Invalid evidence:** missing/null/string/fractional/negative counts and versions; version 0; empty required identifiers; false enum labels; fake IANA zone; impossible Feb 30, nonleap Feb 29, Apr 31 and reversed date range; local time 24:00, minute/second 60 or excess fractional digits; missing/non-zoned audit timestamps.
- **Authorization:** unrelated workspace recurrence row must fail with `SNAPSHOT_RPC_SCOPE_MISMATCH`. Note that DB/RLS authorization still needs separately authenticated two-owner QA; a mock RPC cannot prove tenant isolation of installed policies.
- **Positive practical effect:** staff sees only a saved schedule with complete evidence; unverified projection is unavailable for staff action rather than silently fabricating zero visits. No recurrence materializer, scheduling cron, provider calendar send or customer notification is activated.
- **Bounded concern:** this source parser validates a persisted SQL projection, not the complete domain recurrence scheduling semantics or timezone offset transitions. Postgres may support civil dates outside four-digit years; they are deliberately not certified by this bounded staff-view parser. Cross-field `max_occurrences >= generated_occurrences` is **not** required by installed SQL constraints and is not invented.

## Evidence and verdict

- Source-only change in Core `src/server/core/conversation-postgres.ts`; regression suite `tests/db/v4-r17-recurrence-snapshot-persisted-evidence.test.ts`. Source and tests are isolated from concurrently merged R17 quote, finance and AI paths. Core PR #590 is DRAFT pending exact-head `pnpm check:rc`, merge parity and independent Critic acceptance integrity.
- **Initial Critic verdict:** **HOLD pending exact PR-head full-source CI**. No local Runtime test result or candidate failure was observed at this document creation. Source-reviewed contract is plausible, but authored tests are not executed evidence.
- **Failures caught so far:** zero CI failures observed (not a PASS until jobs finish). **Runner minutes:** not measured, do not fabricate. **Efficiency:** one coherent code/test PR plus one independent Markdown-only Critic PR; avoid rerunning green exact SHA, merge jointly only after all checks and then run canonical full Chrome and PG17 once.
- **Production gates:** [merchant UAT #487](https://github.com/SaamVR/ServiceDesk/issues/487) remains BLOCKED without two distinct signed-in owners/actual saved USD prices and quote/visit/invoice evidence. Migration 0063 remains OFF. Render review/production main and real provider operations are not covered by this source acceptance.

**Promotion rule:** only after exact-head required checks PASS and controller HEAD verified; record merge SHA, then require exact canonical full source/Chrome and independent PG17/worker PASS. Do not mark `OPERATIONS_VERIFIED` or `PROVIDER_VERIFIED` from mock tests.
