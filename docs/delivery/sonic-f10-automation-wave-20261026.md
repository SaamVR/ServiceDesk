# ServiceDesk SONIC F10 — Second operational automation-feature tranche

**Issue:** [#853](https://github.com/SaamVR/ServiceDesk/issues/853) · **Original control plan:** [#173](https://github.com/SaamVR/ServiceDesk/issues/173) · **Master:** [#808](https://github.com/SaamVR/ServiceDesk/issues/808). Source baseline `1003075d1bfcefb6415d6c9a4bdda9c57a0546ff`. Feature lane only; Production owns all fixes, migrations, integration and release.

## New source functionality

- **Spam-lead review (#173 task #5):** accepts only an OWNER-scoped saved inbound lead `OPEN` row and bounded, persisted rule-signal risk score. Scores 80–100 suggest a human review of suspected abuse; lower scores produce `NO_REVIEW_SIGNAL`. No automatic suppression, blacklist, deletion, complaint or customer notification.
- **Property/service-zone branch routing (#173 task #7):** matches a proposed branch to an independently claimed saved coverage-map branch and bounded zone code. Returns an owner-reviewed route suggestion, not an assignment or authoritative branch policy. Real coverage table and staff permission must be rechecked at actual writer.
- **Expired crew/booking hold review (#173 task #24):** a saved `HELD`, `NOT_RELEASED` hold with an explicit-zone expired time yields a release-review candidate, not a released slot or a new crew assignment. Future expiry is `NOT_DUE`.
- **Complaint recovery (#173 task #54):** `OPEN`, `NOT_RESPONDED` HIGH complaint after two hours or CRITICAL complaint immediately suggests human triage. Does not draft/send a response, issue refunds, close a case or produce delivery proof.

These policies deliberately return no live provider/financial side effect and no claimed saved task. Their output fingerprints bind source ID/version and allowlisted state fields but are not atomic idempotency or source authentication. The deadline-oriented business value is to give a future approved owner automation runtime four real, deterministic decisions without hallucinating an outcome.

## Integration dependencies (Production release lane)

1. Owner-authenticated, branch-scoped saved record query and an immutable current source version / event journal.
2. Explicit human approval on source action and proof of truthful consent/quiet hours when communication is eventually added.
3. Transactional internal task writer with unique idempotent event+source+rule-version key; bounded recovery and dead-letter, provenance and signed-in two-tenant UAT.
4. Branch routing must verify persisted service-zone-to-branch coverage, not merely compare two caller fields. Spam signal must have an authorized saved classifier/rule decision and cannot automatically punish a lead.
5. No new feature module may silently redefine the current five-event/three-action published workflow contracts, activate N8N, send WhatsApp or email, charge/refund or interfere with approved Production migrations.

## Acceptance and handoff

Files: `src/server/ai/sonic-f10-lead-triage.ts`, `sonic-f10-field-recovery.ts`, paired `tests/ai/` suites, and this runbook. Lanes own disjoint paths; integration PR only, source CI exact-head success (tests, types, lint, Next build), merge-tree parity and critic integrity. **G0 passing does not count any of the original 72 workflows LIVE**. Owner has authorized source feature development, not live publication or canonical merge.

The earlier F09 8+4+4 source batch is a separate DRAFT PR. F10 is additive and does not depend on or overlap F09 source paths.
