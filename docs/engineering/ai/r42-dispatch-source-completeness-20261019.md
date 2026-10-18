# SONIC R42 — L06 dispatch AI review saved-source boundaries

The existing saved crew suggestion engine correctly requires human approval, but did not inspect `attentionItems` or reject a forged field row prototype before scoring. This lane verifies bounded dense rows, field accessor/prototype safety, service-code allowlist, exact tenant and attention identity/status/severity before calling the scorer. Invalid source returns `DISPATCH_REVIEW_SOURCE_UNVERIFIED`, not a high-confidence crew recommendation or unhandled crash.

This remains a deterministic, read-only operator review. Neither calendar availability nor crew assignment is confirmed by this result; actual assignment command must reread persisted versions, calendar and authorization. No deployment, model prompt or provider sends.
