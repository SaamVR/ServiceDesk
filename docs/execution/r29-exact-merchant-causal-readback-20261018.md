# R29 CORE-O — exact quote-source business chain, no fictional acceptance

The former read-only [merchant coherence diagnostic](../../scripts/release/v4-merchant-coherence-readonly.sql) requires only independently existing records in a workspace. It deliberately does **not** prove that they belong to the same customer request/quote or triggered the same automation.

New read-only query: `scripts/release/v4-merchant-exact-quote-chain-readonly.sql`. It requires:

1. Saved accepted, current, non-superseded quote linked to the same-workspace request with a real branch.
2. Actual saved invoice with the **exact quote ID, workspace, currency and face amount**.
3. Matched LIVE QUOTE_ACCEPTED execution in exactly that workspace and branch whose immutable SHA256 `execution_key` reconstructs from that **specific quote ID**; existing `workflowExecutionKey` is the source algorithm.
4. Saved SUCCEEDED CREATE_ATTENTION workflow action plus an exact-workspace attention record pointing to the same execution.
5. Returns **aggregate counts only**, no tenant IDs, pricing numbers, identities, customer records or provider effects.

Read-only SQL was checked directly against the connected staging schema; currently this environment has no accepted quotes or invoices, so the expected aggregate result is zero. The query uses installed `extensions.digest(text,text)`; future target environments must verify this function exists before relying on the diagnostic.

This is a **stronger causal source-identity and persisted-link preflight**, but it does NOT prove actual customer-session acceptance, independent two-owner RLS, transactional capture, mail/WhatsApp delivery, or settled payment. Those require separately approved signed-in staging operations. Never promote it to merchant UAT PASS or seed data merely to turn counters nonzero. No writes or DDL were executed.
