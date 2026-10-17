# R17E Independent Critic — Authoritative recurrence snapshot proof (#552)

**Date:** 2026-10-17 (UTC). **Independent logical Critic lane**, same controller conversation; this does not represent a separate running human or agent. **Canonical start:** `a37323f1019b866bf7b87ec4a71275c937a3121f`. **Core candidate:** [PR #590](https://github.com/SaamVR/ServiceDesk/pull/590), source/test head `94cdc4ac59f1b794d6d134fdf28bf4c0551261c8`.

## Defect and practical merchant consequence

Existing `recurrenceRuleFromRpc` in `src/server/core/conversation-postgres.ts` used `Number(field(...) ?? 0)` for `generatedOccurrences` and `version`, and `String(field(...))` for identities/dates/timezone/status. A damaged SQL snapshot could appear as legitimate zero generated visits or version 0, or expose the literal text `undefined` as if it came from saved scheduling data. This directly risks misleading staff recurrence visibility; it is not evidence that any actual customer appointment was generated or missed.

Candidate checks saved required fields, supported frequency/status and IANA-valid timezone, SQL date and TIME formats, nonnegative integer `generatedOccurrences`, strictly positive integer `version`, nullable strictly positive `maxOccurrences`, and offset-aware saved timestamps. Rejecting any corrupted row routes the full read through `SNAPSHOT_RPC_ERROR_MALFORMED`, not an invented empty schedule. Foreign-tenant rules retain `SNAPSHOT_RPC_SCOPE_MISMATCH`.

## Separate Product lane: preview action truth (R17F)

Independent source review found that `RecurrenceRulePreview` has no `onClick` or server action callback even when its parent passes `actionsInjected=true`, yet `buildRecurrenceActionAvailability` returns enabled PAUSE/SKIP controls. This is an inert enabled control, not a real scheduling action. [Product PR #593](https://github.com/SaamVR/ServiceDesk/pull/593) at `1dd11c6db0a575f1369c65af3f6b9a6dacb19ec4` keeps this *preview only* component's controls disabled irrespective of the prop, shows an explicit limitation, and adds React server-rendered positive/negative tests for ACTIVE/PAUSED/COMPLETED/staff/customer and no fabricated VisitDTOs. This cannot substitute for a future real server-command UI. Source/checks are independent of Core #590; do not overwrite either lane.

**Product verdict at this document revision:** **HOLD** until full-source RC finishes at its exact PR SHA. Review merge parity and Critic-integrity checks already PASS. This is a practical UX/read-only correctness fix, not evidence of working pause/resume/skip actions.

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
- **Core source Critic verdict: PASS, operational verdict: HOLD.** [Core PR #590](https://github.com/SaamVR/ServiceDesk/pull/590) immutable head `94cdc4ac59f1b794d6d134fdf28bf4c0551261c8` passed [full-source RC #39016876346](https://github.com/SaamVR/ServiceDesk/actions/runs/39016876346), [merge-tree parity #39016876351](https://github.com/SaamVR/ServiceDesk/actions/runs/39016876351), [Critic integrity #39016876405](https://github.com/SaamVR/ServiceDesk/actions/runs/39016876405). Source PASS does not certify enabled scheduling mutations, merchant UAT or provider actions.
- **Failures caught:** zero CI failures observed in the reviewed Core source candidate at its final immutable SHA. The important *pre-CI* source defect was the original silent missing-count/version coercion. **Runner minutes:** not measured; do not fabricate. **Efficiency:** two disjoint source/test PRs, independent Critic documentation and one combined integration attempt after source gates, with one canonical full Chrome + PG17 pair after merge.
- **Production gates:** [merchant UAT #487](https://github.com/SaamVR/ServiceDesk/issues/487) remains BLOCKED without two distinct signed-in owners/actual saved USD prices and quote/visit/invoice evidence. Migration 0063 remains OFF. Render review/production main and real provider operations are not covered by this source acceptance.

**Promotion rule:** only after exact-head required checks PASS and controller HEAD verified; record merge SHA, then require exact canonical full source/Chrome and independent PG17/worker PASS. Do not mark `OPERATIONS_VERIFIED` or `PROVIDER_VERIFIED` from mock tests.
