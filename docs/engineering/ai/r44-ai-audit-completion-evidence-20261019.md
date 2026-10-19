# SONIC R44 — AI action audit refuses unverified completion claims

The generic `buildAiActionAuditRecord` is fed tool-result summaries; a string `COMPLETED` with a convincing `evidenceRef` is not a saved provider or business execution receipt. Previously the owner-visible audit copied that claim directly. A model or mock could appear to have charged a customer, sent a message, or approved a workflow without any persisted action.

This source change preserves safe `PROPOSED`, `BLOCKED`, and `FAILED` summaries. An incoming `COMPLETED` is downgraded to `PROPOSED`, its unverified reference and potentially false prose are omitted, and a bounded counter records that human review of saved execution evidence is needed. To show real completed business actions, an independent verified saved-row reader must supply an authoritative receipt through a separate future API. This change itself performs no model call, provider send, payment, database update or business effect.
