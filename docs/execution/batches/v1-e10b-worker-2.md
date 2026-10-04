# V1 E10B Worker 2 — Sandbox Checkout Bridge

Branch: feat/servicedesk-v1-connectors-e10b
Base: 25e5770e96b250923c81254f0477461fc89feb4f

Mission:
- expose the existing Stripe-style checkout adapter through a safe server-side SANDBOX-only command boundary;
- require authoritative accepted quote + live hold identifiers/expiry;
- resolve provider config server-side, never from Product payload;
- reject LIVE mode under current owner policy;
- return only safe checkout launch data;
- never mark payment/visit/invoice as paid or confirmed;
- update final provider preflight for quote-acceptance/hold checkout prerequisites;
- package-free harness and tests;
- no real provider verification claim.

Receipt: docs/execution/receipts/v1-e10b-worker-2.md
