# R42 L20 owner workday + real attention SLA

Connects the newly merged authenticated saved-attention SLA review to the existing model-independent, double-snapshot owner workday entrypoint. Previously workday priorities exposed critical counts but not real overdue items or their saved dueAt. The new `attentionSla` reports concrete persisted attention IDs, zoned due evidence and overdue minutes. Both reads must agree, including dueAt and status, even when aggregate queue counts remain unchanged. It does not contact customers, execute workflows or generate a model answer.

This integration is source complete after exact-head CI; rendering the new field in Studio remains a separate owner-UX task.
