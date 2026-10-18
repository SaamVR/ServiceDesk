# Independent critic — provider receipt redaction

An outbox state transition from SENT may include an untrusted provider-supplied reference. The old policy propagated arbitrary strings, including recipient emails, URLs, credentials or huge payloads, into a durable receipt. The critic requires a bounded provider-identifier grammar, never copying unsafe strings, while accepting normal WhatsApp-style opaque IDs. This affects no external provider call and does not assert real delivery.
