# Independent critic R37 — fail-closed poisoned owner source

The model-free owner workday module aggregates saved operational rows and must
never let a malformed/hostile accessor crash the dashboard or expose a stale
priority result. These separate negative tests inject accessor-backed request
rows in the first and second authoritative snapshots and demand bounded,
redacted errors (initial unavailable, second drift). No external provider
calls or customer data are required.
