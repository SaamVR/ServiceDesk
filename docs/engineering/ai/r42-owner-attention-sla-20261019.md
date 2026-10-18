# R42 L16 Saved attention SLA owner review

**Implemented source**: double-owner-read escalation evidence for actual saved attention `dueAt`, not model-invented deadlines. This is a non-sending, non-mutating assistant entrypoint. A completed/acknowledged item is handled according to its actual saved status; resolved items are excluded. Due tasks with no dueAt remain unscheduled, never labelled overdue. Owner scope, complete bounded snapshot, duplicate IDs, Gregorian zoned clocks, stale second reads and safe redaction are enforced. The output gives count and priority-sorted durable attention IDs only, no private summary or communications.

No background scheduler, publication, provider delivery, or real production owner journey is claimed. Connect to Studio after separate UI ownership review.
