# ServiceDesk QA real database sample seed

## Intended behavior

Only an **authenticated, email-confirmed, allowlisted QA owner** may click "Add fictional QA records" from the verified business welcome page. This is explicitly QA-only and requires operationalDatabaseMode() = QA_SESSION_RLS. It uses the same signed-in Supabase SSR client: all operations remain subject to RLS, MAIN branch/OWNER checks, and the existing schema.

It creates/resumes three **clearly fictional**, workspace-scoped records:
1. Casey Sample (fictional), lead source SERVICEDESK_QA_SAMPLE_V1, no real contact details.
2. Non-real QA property in the signed-in owner's MAIN branch.
3. New three-bedroom/two-bathroom request with JSON marker {qa_sample_version:1,synthetic:true,provider_connected:false}.

It NEVER sends an email/WhatsApp message, charges a card, creates a payment token, provisions a user, or bypasses verified Auth.

## Limitations

- Unlike the local /sandbox, this test data is persisted in the real Supabase staging database.
- This is a resumable multi-statement operation, NOT a DB transaction. It reuses existing customer/property/request records by immutable markers on subsequent sequential requests. Concurrent clicks could still race; operators must use one tester at a time until a DB-atomic idempotency key is introduced.
- Any RLS permission or constraint failure is surfaced as a generic operator error; avoid publishing raw provider messages/customer data.
- Do not use on real customer tenants or enable with public registration/production service role. No automatic seeding at page load.
- Connected Supabase verification now shows one real, email-confirmed QA owner and active workspace. No fictional customer/property/request records have been seeded yet. Actual user-triggered write, persistence, duplicate prevention, and tenant-denial browser proof remain acceptance gates.

## Manual E2E

1. Use an allowlisted test email to sign up, click the delivered verification link, create one fictional business.
2. Open /onboarding/verified?workspace=<your-test-slug>, click Add fictional QA records.
3. Check "saved" notice and open the operational dashboard. Verify exactly one fictional customer, property and new enquiry.
4. Click again; expect no duplicates (sequential idempotency); reload and verify still persisted.
5. Sign out and use a different tester/slug; no sample data may be visible or writable.
6. In staging only, inspect DB for workspace-specific QA_SEED_SOURCE and JSON synthetic marker, then clean up test records through approved deletion procedure before commercial rollout.
