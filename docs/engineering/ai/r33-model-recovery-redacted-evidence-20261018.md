# L01 R33 — safe failure recovery evidence

Previously AI model recovery concatenated raw tenant and conversation identifiers into log-ready `redactedTarget`, `notes`, and idempotency keys. This new provider recovery guard hashes stable scoped identities into an opaque digest, rejects malformed identities/retry budgets/time anchors without throwing or scheduling wrong retries, and routes unsafe evidence to operator review. The downstream recovery remains informational/retry policy only: no business payment or message mutation.

Avoid inventing provider delivery or treating this as evidence of successful model inference. Contract and redaction tests cover transient, invalid-schema, configuration and poisoned input cases.
