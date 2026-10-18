# R37 / AI-D — owner workday still works if the AI provider is down

A real authenticated server-side read of operational queues (using the
existing staff actor resolver and saved snapshot loader) now produces all
seven deterministic owner action priorities **without making any AI provider
request**, even when Samai is disabled or times out. Owner role/user/workspace
and fresh saved counts are verified twice; changed counts/tenant/session are
rejected rather than shown as current. No contacts, financial amounts, raw
notes or customer PII are sent to models. No customer message, payment or
workflow side effect.

`loadOwnerWorkdayPriorities` is the server capability; AI Studio/owner
route display must be wired by the separate frontend lane. No owner browser
UAT has occurred from this PR. It is a functional source fallback, not
an unattended scheduled digest or a proof of live AI inference.
