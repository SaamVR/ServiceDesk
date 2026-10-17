# Independent CRITIC-01 R29 — merchant-chain usefulness and false-proof checks

Scope: Postgres 17 disposable fixture review of [CORE-O PR #635](https://github.com/SaamVR/ServiceDesk/pull/635). This PR **does not edit CORE-O's SQL** and does not touch connected Supabase, Render, production, or user data.

Review criteria:

- A realistic fictional positive tuple (accepted unsuperseded quote → exact-workspace invoice → recomputed immutable quote-source LIVE rule execution → successful action → exact matching attention item) must count precisely once.
- A different tenant's unrelated execution must NOT steal credit merely because it has a QUOTE_ACCEPTED event, successful action and attention.
- Tampered execution identity, FAILED action, unrelated attention resource, wrong invoice amount, superseded quote and unaccepted DRAFT quote must independently collapse the complete-chain count to ZERO.
- Only aggregate counts may leave the query. No tenant identifiers, PII, provider receipts or artificial money savings.
- This is a saved record chain; it does not establish actual human authorization, settlement or provider delivery.

This critic tests source/SQL fidelity and vetoes any claim of merchant UAT/production readiness from the fixture. No pre-approval to seed connected staging or call AI/payment providers.

Success conditions: [PG17 CI proof](../..//.github/workflows/v4-r29-merchant-causal-pg17.yml) passes all seven scenarios; CORE-O SQL itself remains untouched by critic. Missing live two-owner QA and 0063/0064/0065 migrations remain independent blockers.
