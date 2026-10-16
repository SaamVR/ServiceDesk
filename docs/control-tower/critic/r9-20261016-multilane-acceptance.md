# ServiceDesk V4 — R9 independent Critic acceptance ledger
Date: 2026-10-16. Lane D is a distinct **review role and GitHub workstream inside this conversation**, not a claim that a separate human or continuously running autonomous agent was present.

## Source/release truth
At start: canonical V4 SHA `1cc6dc939fc640bce1f90d61a4ec1c996a2b6bc9`. Exact-head [full source RC](https://github.com/SaamVR/ServiceDesk/actions/runs/38926824892), [PG17 source recovery](https://github.com/SaamVR/ServiceDesk/actions/runs/38926825004), and [review merge-tree parity](https://github.com/SaamVR/ServiceDesk/actions/runs/38926829753) SUCCESS. Source-parity check is not deployment acceptance. Latest rendered review still observed LIVE at `5b876a7a806b5b63eca8e1b9396a3a7509240ec6`, and review PR [#509](https://github.com/SaamVR/ServiceDesk/pull/509) is intentionally draft/unpromoted.

## Independent review of active lanes
| Lane | Source | Defect challenged | What is validated | Real-world boundary |
| --- | --- | --- | --- | --- |
| A — Provider reliability | [#515](https://github.com/SaamVR/ServiceDesk/pull/515), initial `33a49599...` | Outbound persisted `created_at` years ahead of reporting clock appeared age 0 / pending because negative elapsed time was clamped to zero | Exact-head [full CI #38928509895](https://github.com/SaamVR/ServiceDesk/actions/runs/38928509895) PASS, [Critic CI](https://github.com/SaamVR/ServiceDesk/actions/runs/38928509680) PASS, merged as `aa66f8905a3774c800d93bc9e320bbd54b5a3283`. Bounded 5-minute skew and negative future tests. | Still no live delivery/WhatsApp UAT or provider receipt |
| B — Core persisted conversation | [#514](https://github.com/SaamVR/ServiceDesk/pull/514), initial `44cd747d...`, corrected source candidate `87d24575...` | `Boolean("false")` could display a true handover; `Number(version ?? 0)` could invent successful initial state from missing SQL truth | Initial [full CI #38928291139](https://github.com/SaamVR/ServiceDesk/actions/runs/38928291139) **failed** across historical inbound HTTP fixtures missing installed SQL fields. Candidate updated fixtures and negative/positive tests; new exact-head full CI must pass before merge. | Real signed-in two-owner inbox/handovers NOT verified |
| C — AI owner advisory | [#516](https://github.com/SaamVR/ServiceDesk/pull/516), `a41f6fee...` | Numeric-count-only AI brief could still advise contacting `clients`, `leads`, `guests`, `team` rather than literal `customers` | Negative output-guard regressions added; exact-head full-source review pending. | Paid-model real quality/merchant usefulness unverified; no messaging sends |
| D — Critic and release | This file, [security #153](https://github.com/SaamVR/ServiceDesk/issues/153), [UAT #191](https://github.com/SaamVR/ServiceDesk/issues/191), [review #509](https://github.com/SaamVR/ServiceDesk/pull/509) | Green source CI could be mistaken for live merchant outcome; old security definer helper could reveal default branch ID to authenticated cross-tenant caller | Read-only Supabase function/proc review; comments attached to A/B/C PRs; current material integration failures and evidence classes recorded | Operator-authorized actual tenant, owner price book, real provider and deployed /health source checks missing |

## Critic quality standard
1. **Before implementation:** Identify the actual durable source and business mistake, the failed scenario, exact negative proof and positive nonregression.
2. **During implementation:** Reconcile installed RPC payloads versus test mocks. An existing mock that omits required persisted evidence is not proof the production SQL omits it.
3. **At PR head:** Require a specific exact HEAD, focused adversarial test, full TypeScript/build/regression, critic claim-integrity and disjoint file ownership.
4. **At release:** Review-source tree equality is separate from Render LIVE source equality. Do not infer actual auth, merchant flows, payment success, AI model usefulness or external provider delivery from fixture CI.
5. **Efficiency:** Three isolated code modules, one Critic-owned document, shared canonical integrator. Eliminate redundant full-test fanout and never merge stale heads or silently overwrite another lane's work. Report durations only from GitHub timestamps when computed.

## Current external blockers
- Connected stage still lacks owner-approved catalog/rate book/accepted quote/invoice/payment workflow evidence needed to complete a real commercial journey. Do not fabricate data.
- Migration 0063 has no connected application approval and must remain default-off.
- `servicedesk_default_branch(target_workspace uuid)` is an authenticated-callable SECURITY DEFINER function with no internal active-membership filter. This is an unproven cross-tenant metadata exposure hypothesis, not a witnessed exploit; mitigate only with a reviewed trigger-safe migration and negative/positive multi-owner PG17 proof. No SQL mutation was performed.
- Manual isolated Render review promotion requires a separate release authorization; no deployed R9 feature is claimed.

**Overall: source engineering advancing; OPERATIONS_VERIFIED, PROVIDER_VERIFIED, COMMERCIAL_READY all BLOCKED.**
