# R37 AI-B — guarded reply must follow model action-risk evidence

Previously a model could return a perfectly harmless-looking reply and a blocked
payment/provider tool call. The plan correctly marked human handover but still
surfaced that same model reply as customer-facing copy. This now uses a fixed,
redacted handover recommendation whenever a blocked tool, prompt injection,
cross-customer, provider failure, unsupported job or explicit handover flag
appears. Citations to disallowed model advice are withheld. Exact workspace/
conversation/saved-human-message identity and bounded model labels are required
before producing any plan.

This modifies the pure server planning contract. It cannot itself send a
message or mutate a customer ledger. Focused adversarial tests validate the
mixed safe-text + unsafe-tool case, risk flags and malformed source identity.
