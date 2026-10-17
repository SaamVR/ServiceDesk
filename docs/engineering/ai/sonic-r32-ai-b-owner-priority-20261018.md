# SONIC AI-B — actionable owner queue priorities

The existing owner AI advisory returns a free-text model draft after verifying two tenant-scoped, fresh snapshots. It did **not** provide direct saved-queue action destinations; the model must not invent routes or counts.

This additive lane introduces a **deterministic, count-grounded review action** for each of the seven already-verified owner buckets, ordered by criticality and limited to the first five nonzero categories. No PII, contact, pricing, numeric revenue, assigned crew or raw record is forwarded to a model. The model remains purely advisory and the owner priority cards are server-generated only after both owner/snapshot checks.

Actual categories: critical attention, mismatched invoice ledger, quote validity, unassigned active visit, collectible invoice, waiting quote, open requests. Each shows an exact saved count and links to a real module. Zero/poisoned/partial/additional keys fail closed. No due dates, overdue assertion, direct email send, automatic pricing, payment, booking or queue writes.

This is functional *source* code, not proof of working deployed AI Studio; actual authorized owner Chrome QA and saved positive counts are still required. Existing Samai gateway is synthetic-only validated and cannot be switched on for unrelated tenants.
