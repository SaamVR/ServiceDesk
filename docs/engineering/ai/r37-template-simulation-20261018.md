# R37 / Lane AI-A: functional matching for existing automation starters

The 27 existing workflow starter recipes were catalogued but never matched
through the real workflow evaluator in a bounded owner simulation. This lane
adds `simulateAutomationCatalog`: an owner-scoped hypothetical event preview
that runs supported event facts through the production rule evaluator against
the current safe attention-only starter list, returns ranked catalogue order,
real matched/truncated totals, and explicit **no publish/no execution/no customer
send/no charge** flags. It cannot accept contact/payment fields or bypass
human rule publish and provider approvals.

No real event is captured; no tenant database read; no synthetic preview equals
committed execution. Studio UI and human rule creation require separate wiring.
Tests cover matching, absent facts, tenant scope, hidden injected fields,
bounded output, and financial/providery claims.
