# V4 engineering role map and separation rules
Status: coordination protocol only, not a claim of 12 running agents. Observed controller SHA `7c826383c61c1a68c7701b2b937e4cb0695c5abf`.

| Responsibility | Scope | Current evidence |
|---|---|---|
| 1. Domain/backend | Core, `src/server/core/**`, SQL, domain tests | R6G/H/I integrated in canonical source |
| 2. Product/frontend | Product, `src/features/operations/**`, UI tests | Terminal quote correction draft PR #481 |
| 3. AI intelligence | Connector/AI server and tests | Source implementation; real provider UAT unverified |
| 4. Provider integrations | WhatsApp/email/webhooks | Controlled provider transaction unverified |
| 5. Commercial operations | Quote/booking/invoice full workflow | Authenticated merchant walkthrough unverified |
| 6. Multi-tenant security | Auth, RLS and row scope | Two separate account staging proof pending |
| 7. Automation | Journal, leases and execution | PG17 source CI success; 0063 not installed |
| 8. QA/acceptance | Browser, persistence, negative journeys | Current live review SHA mismatch blocks current proof |
| 9. DevOps/release | Controller, CI and Render | Blocker issue #483 |
| **10. CRITIC-01** | **Separate audit branch, documentation, issues/reviews** | Independent branch plus issue #483 and #484, but NOT a second AI/person |
| 11. Architecture/integrator | Coordinator, shared contracts, conflicts | Observed canonical exact-source RC success |
| 12. Merchant-value reviewer | Authorized real owner/staff UAT | NOT staffed or verified here |

Actual concurrently running workers cannot be inferred from these 12 specializations. Three historical code ownership lanes were observed; this runtime has a Product fix branch and a separate critic audit branch. Additional agents need explicit activation and distinct receipts.

## Path ownership and release discipline
- Core controls schema/core changes; Product controls staff UI fix; CRITIC-01 controls `docs/engineering/critic/**` and GitHub critic findings; controller controls shared configs/integration/promotions.
- Work on isolated nonoverlapping branches, check live exact head, and never overwrite protected work. Existing repository instructions disallow connected local device development.
- Critic is in this development chat but structurally separated from the implementation PR, has veto findings, and must not be considered an independently executed agent or sole approver of its own fixes.
- Report UNIT, INTEGRATION, BROWSER, PERSISTENCE, EXTERNAL PROVIDER and REAL USER UAT separately; neither mock contract nor source CI implies delivery or customer acceptance.
- Every criticism ends FIXED AND VERIFIED, ACCEPTED RISK WITH OWNER or OPEN BLOCKER; unresolved findings survive handoffs.

## Ordered next gates
1. P0 release guardian: resolve exact live review SHA mismatch #483, then guest and authenticated browser proof; no production promotion on an unverified candidate.
2. P1 Product: review draft PR #481 after pinned test proof, then obtain staff confirmation that terminal quotes are not actionable.
3. P1 Core/security: authenticated two-owner positive/negative tenant RLS and quote-to-accepted state readback in authorized staging.
4. P2 Controller: measure stale PR reconciliation and push-time manual-deploy CI waste before any process change.
