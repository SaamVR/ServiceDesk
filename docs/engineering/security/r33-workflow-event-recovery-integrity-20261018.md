## CORE-L08 R33 event envelope truth

Adds fail-closed shape/scope/finite-number checks to the existing production workflow evaluator. Recovered malformed JSON must not throw a TypeError or be fingerprinted/accepted as a trusted business event. Deny nonrecord/inherited accessor snapshots, nonfinite scalar/array numeric values, long strings in arrays, poisoned scope and parent identities. Preserve existing real event identity and fingerprint equivalence, without changing action authority. The critic will attempt sibling adversarial fixtures.

**Scope**: source and domain contract only. Installed staging migration 0063 and unattended worker invocation still require separate authorization. No DB/provider/production mutation.
