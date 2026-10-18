# R39 L16 — source-trusted completed visit automation

`VISIT_COMPLETED` is an automated workflow trigger, but a string accepted by permissive `Date.parse` cannot prove the scheduled visit's real start and end. Reuse the project's established `trustedQuoteInstant` (civil date and explicit timezone verifier) before emitting verified completion. Preserve early completion semantics and source-only evidence; no provider sends, DB mutations, or automatic job acceptance. Three adversarial test groups cover impossible dates, UTC offset spoofing, nonfinite clocks and real zoned microsecond records.
