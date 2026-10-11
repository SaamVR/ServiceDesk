# ServiceDesk V3 interactive sandbox — implemented test mode

**Scope:** Public, browser-local simulation. It is a safe preview, **not** a connected staging tenant and not an alternative signup path.

## Operator quick start

- Open /tour -> **Open interactive sandbox**; direct route /sandbox.
- Sample operator: BrightRoom Cleaning. Customer: Alex Morgan (synthetic).
- Quote calls the real src/domain/pricing.ts function: 3 bedrooms, 2 bathrooms and oven -> USD 340 total, USD 85 deposit, USD 255 balance, 240 minutes + 30-minute buffer.
- Click all eight transitions. Check single deposit/balance allocations and USD 0 outstanding at completion.
- After deposit stage, queue a mock confirmation, inject failure, retry and simulate provider acceptance. Never claim Delivered or Read.
- Refresh the page to verify the simulation resets and has no persisted session.
- Reset button replays the workflow without duplicate records.

## Evidence and limits

- Engine: src/features/sandbox/sandbox-engine.ts is pure in-browser state, reusing domain pricing.
- View: src/features/sandbox/SandboxJourney.tsx; no server actions, auth bypass, credential access or provider calls.
- Invariant tests: tests/e2e/v3-sandbox-workflow.test.ts. CI: .github/workflows/v3-sandbox-rc.yml.
- **No signup is enabled:** connected Supabase requires 0037–0059 and the owner-workspace RPC (issue #75).
- **No Stripe test API has been contacted:** UI payments are simulated state, not Stripe sandbox checkout.
- **No Meta, Google Calendar, Resend or OpenAI calls occur.** Acceptance is mock only, never delivery.
- Public route carries robots noindex and has no real customer data.
- Browser/auth/provider validation remains a distinct gate; unit tests and build alone are not live acceptance.

## Follow-up to connected test operations

1. Provision authorized isolated Supabase schema and verified onboarding.
2. Seed a synthetic authenticated workspace; prove tenant persistence, RLS and restore.
3. Configure controlled provider test accounts with real signed webhooks, verified worker receipts and clear TEST state.
4. Capture 40 private authenticated Studio OS screens, review usability and obtain owner signoff.
5. Promote to controlled sandbox beta only after these separate validations.

The source is proposed through an isolated PR against the V3 candidate, not main or live Render.
