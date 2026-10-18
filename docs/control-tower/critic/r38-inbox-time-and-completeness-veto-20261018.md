# CRITIC R38 C23 — Inbox unanswered-proof source veto

The owner inbox planner must not silently normalize impossible February dates, treat an outbound with the **same timestamp** as an inbound as a proven reply, or crash on a sparse/poisoned array that bypasses Array.prototype.some. These are independently constructed negative tests against PR #718. Implementer must treat ambiguous same-instant delivery as reviewable DELIVERY_UNVERIFIED, refuse impossible date and fail closed on sparse list before a source-success return. No simulated sending.
