# R37 AI-E — rule revision review before publishing

Provides an owner-only, provenance-bound comparison of current PUBLISHED
workflow version versus DRAFT revision. Reports bounded change categories,
external-send introduction/removal and the fact that explicit owner
approval is still needed. It rejects stale based-on-version, cross-branch,
unknown actions, hidden/unsafe fields and unsupported event types.

This produces **review metadata only**, not rule persistence/publishing,
automated customer messaging, actual workflow execution or a model call.
Frontend rule builder must explicitly wire it to saved owner-authorized
version reads before portraying the result as current.
