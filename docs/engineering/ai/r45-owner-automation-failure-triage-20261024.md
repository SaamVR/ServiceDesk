# SONIC AI owner failure triage — R45

Adds a production-callable, read-only triage planner for trusted, tenant-authorized persisted execution failure receipts. It flags configuration failures, permanent failures, exhausted retry budgets and legitimate transient retry *candidates* without touching a provider, publishing workflow rule or changing business state. Each receipt is exact-shape validated; malformed, extra/hidden keys, future events, duplicates, cross-tenant rows and exhausted attempts are rejected. It is not a substitute for DB authority, real provider receipts, or owner-approved queue commands.

Integration dependency: authoritative server loader must supply actual scoped failure rows and check logged-in owner identity; UI/product lane should show output as owner review only. No inferred merchant acceptance or unattended automation.
