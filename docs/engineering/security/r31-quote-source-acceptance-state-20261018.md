# R31 CORE-A — prevent post-accept automation from stale quote states

The trusted post-accept bridge previously checked only `quotes.status=ACCEPTED` and request customer linkage. A quote that was later superseded could still look accepted and schedule a fresh internal workflow on replay. An accepted-looking row without a committed `accepted_at` milestone could also pass.

The bridge now reads `accepted_at` and `superseded_by` directly from the authoritative saved quote, checks that the result is the expected quote ID, requires a real accepted timestamp, and rejects any supersession before resolving the request, rule or attempting an internal action.

This does not mutate the database or remove historical workflow receipts. It prevents newly triggered **internal** actions based on stale acceptance facts. A separate source-worker lane must decide how to classify superseded journal events for terminal SKIPPED versus retry while remaining fail-closed. Actual customer acceptance, distinct owner UAT and provider delivery remain unverified.
