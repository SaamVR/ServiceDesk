# ServiceDesk V4 R15 — CRITIC-01 Independent Engineering and Merchant-Usefulness Review

**Reviewer role:** independent quality/throughput critic, logically separate lane inside the Run15 control-tower chat. **Review base:** canonical `6c7f4c57279973cba9e344f0f5e4d51ac192879a` (2026-10-17). **Release disposition:** **BLOCKED / not ready to promote**.

## Review contract and role separation

Critic-01 owns this document, reviews downstream developer branches without modifying their implementations, and cannot approve its own PR as proof of a product capability. Source check/build, disposable PG17, authenticated tenant UAT, controlled provider confirmation and Render deployment are separate evidence classes. A GitHub source/merge-tree check cannot substitute for another.

## Substantive R15 changes under review

| Lane | Candidate / PR | Merchant usefulness | Negative boundary the critic requires | Current evidence ceiling |
| --- | --- | --- | --- | --- |
| Core/Finance R15A | `858850b406a8af52547c9d8be6b8e04d20d7d8ae`, #564 | Prevents an under-sampled branch price-book set from silently yielding a supposedly unique real-owner quote price | 100 rows with one active price book must work; 101 rows with more unobserved active books must fail before rate card lookup | Authored executable DB-contract regression; not a real owner’s price book |
| AI/Connectors R15B | `0033ef18c07c816fe391a9693b947676edd7624a`, #565 | Stops opt-in staff AI review text inventing currency-symbol amounts and promotions | USD words, $, £, €, ৳ and percentage-discount examples blocked; ordinary advice retained; malformed line codes rejected | Authored Vitest contract; **no AI enabled or provider inference** |
| Product/UI R15C | `f2418f89522195f869c6994ddf610b806addc929`, #566 | Prevents zero-value, zero-duration or timezone-ambiguous saved quotes from appearing review-ready | Positive reconciled quote allowed; zero-sum and timezone-less expiry refused; external delivery remains MANUAL | Authored deterministic view-model regression; **not customer acceptance** |

## Independent gaps the developer lanes cannot mark PASS

1. **P0 real merchant workflow remains unproved**: the connected ServiceDesk PG17 instance is a source/disposable fixture. At takeover only one active owner, one USD branch and no active service, price book, saved quote, published workflow, invoice, or outbox were reported. Quote→customer accepts→internal attention→invoice must be observed as real SQL persistence with two distinct *fictional but authenticated* owners, authorized pricing and RLS checks. Do not synthesize evidence in PR prose.
2. **0063 is not applied**: quote accepted → internal source journal is default-OFF; no operational scheduler. A source pass or PG17 receipt does not prove eventual automated attention after crash. Do not enable the worker or submit schema changes without explicit owner authorization.
3. **False confidence risk**: the quote price-book sentinel is a bounded scan, not a scalable authoritative uniqueness constraint. At more than 100 returned active-marked book records it deliberately blocks merchant quoting. Before release consider database-level exclusion/uniqueness guarantees or server-filtered effective ranges, and provide an operator archive/remediation path. No raw SQL changes in this lane.
4. **AI guard limitation**: regular expressions are a denial filter, not semantic verification. Text such as *“one hundred dollars”* or negotiated discounts can evade numeric pattern checks. Strict opt-in and manual staff review remain mandatory.
5. **Staff checklist semantics**: a checklist PASS is only a human-review gate. It does not represent quote SEND delivery, customer acceptance, payment authorization, or an invoice persisted in PostgreSQL. Verify actual staff-facing copy does not silently conflate these.
6. **Deployment gate**: isolated Render review remains on verified R13 `3962aa5c84c3aa5f47ad72b62d51ae4382467708`; current R14 canonical `6c7f4c57279973cba9e344f0f5e4d51ac192879a` is not deployed there. Any later promotion needs pinned exact-sha RC+PG17, owner review and live guest/health checks.

## Quantified throughput criticism

This R15 burst produced three source+test branches from one shared pinned base, with nonoverlapping ownership and one docs-only independent critic branch. This reduces merge conflicts, but each executable PR triggers its own broad full-source RC; redundant full builds are not free. Critic recommends focused unit assertions before creating the next source commit, **one combined full release-candidate validation after actual integration**, and no second PG17/build on a docs-only amendment. No duration, speedup or total test PASS is claimed without GitHub job evidence.

The acceptance clock starts when an executable job is actually scheduled and completes; branch creation and automated check configuration are not measured developer minutes. Before reporting speed improvements, compare meaningful merged feature count, number of unnecessary CI runs, CI minutes, and user-facing steps now unblocked.

## Adversarial acceptance matrix (not executed by this document)

- Tenant A and tenant B cannot read or mutate each other's requests, quote rates, quote revisions, visits, attention, invoices or ledger rows.
- Active and expired price book records across a workspace must not produce two concurrently effective prices; an incomplete scan must fail visibly without creating a quote.
- Quote confirmed by authenticated customer with RLS and expected version; forbidden replay and expired quote fail with no second side effect.
- A quote ACCEPTED event interrupted after commit must eventually create exactly one internal attention receipt **only after** separately authorized 0063, opt-in and scheduler. Provider outbox must not be used as the internal source journal.
- Invoice persistence must be re-read at authoritative tenant scope; a UI toast or source-only mock cannot stand in for a saved row. No real payment, message, provider send or auto AI call.

**Review verdict**: R15A/B/C may qualify as **CONTRACT_TESTED** after exact-head full source results; **OPERATIONS_VERIFIED / PROVIDER_VERIFIED and release promotion remain BLOCKED**. Critic-01 recommends resolving #487 real merchant UAT with authorized two-owner setup, while holding #153 security and #518 efficiency and preserving the R13 Render deployment until signed-off promotion.
