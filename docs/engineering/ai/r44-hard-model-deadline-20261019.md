# SONIC R44 — hard AI transport deadline (provider lane)

The existing `callAiModel` AbortController terminates compliant fetch adapters, but an injected/third-party adapter can ignore `signal` and keep the authorized staff operation unresolved indefinitely. This change races the provider request against a local abort promise and guards late 200 responses after timeout. Caller cancellation remains AI_MODEL_CANCELLED, timeout AI_MODEL_TIMEOUT, and the official OpenAI 30s and private fictional Codex 60s caps remain unchanged.

Tests cover hung adapters, caller abort, late 200, successful model output, and bounded fictional gateway inference. Does NOT prove the deployed Studio was exercised, expand commercial use of the personal Samai gateway, persist AI drafts or send customers any message.
