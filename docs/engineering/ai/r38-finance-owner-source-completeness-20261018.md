# SONIC R38 C30 — owner financial source completeness

`loadOperationalStaffSnapshot` reads invoices with an explicit `.limit(300)`. The preexisting authenticated owner finance exception reader derived a supposedly complete review even when its snapshot had exactly 300 invoices, potentially omitting further uncollected or inconsistent invoices. This PR refuses `>=300` on both source reads, distinguishes INCOMPLETE from changed saved state, and fails closed if ledger comparison throws. Less than 300 rows is evidence the workspace-wide read did not reach its cap. The function remains owner-only, double-checked, non-mutating and produces only human-review suggestions.

This does not authorize automatic collections, payments, refunds, reminders or external provider delivery. The future long-term solution is paginated server-scoped collection + durable cursor proof, not an arbitrary higher limit.
