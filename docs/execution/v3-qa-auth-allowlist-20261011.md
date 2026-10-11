# ServiceDesk V3 — controlled QA account registration

**Status:** Database SCHEMA_VERIFIED; SMTP and authenticated browser journey NOT YET VERIFIED.

## Database gate closed (Oct 11, 2026)
- Connected ServiceDesk Supabase staging has 66 migration-history entries, through sd_0059_v3_verified_owner_workspace_bootstrap. All 0037–0059 applied in strict order.
- Workspace branch and branch membership tables exist with RLS enabled.
- Owner bootstrap RPC can be executed by authenticated, NOT by anon, and requires a verified email and atomic owner workspace setup.
- Before account tests there were zero Auth users, workspaces and memberships.
- No real payment, Meta, Calendar or AI providers enabled by this work.

## Invite-only test access, not public release

On isolated V3 Render review, configure these keys outside Git:
- NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: matched ServiceDesk staging public API project and publishable key.
- SERVICEDESK_AUTH_REDIRECT_ORIGIN: exact HTTPS review host.
- SERVICEDESK_OWNER_REGISTRATION_ENABLED=false (public signup stays off).
- SERVICEDESK_OWNER_REGISTRATION_QA_ENABLED=true.
- SERVICEDESK_OWNER_REGISTRATION_QA_EMAILS: 1–10 approved consenting test inboxes, comma-separated; never commit their values.

Direct /auth/sign-up renders a real form only in QA-only or PUBLIC mode. Server-side actions independently enforce allowlist before signup, resend and owner RPC. Marketing continues to route public visitors to the product tour. No test-mode bypass of Supabase Auth, verified email, role checks or RLS.

## Mandatory live Auth acceptance

1. From an allowed test email: password signup → neutral check-email view.
2. Receive and click an actual SMTP confirmation; validate HTTPS /auth/confirm and cookie/session on the approved host.
3. Confirmed account → /auth/continue → create named synthetic business, one OWNER/ACTIVE membership, MAIN branch and audit.
4. Sign out, sign in, reopen correct workspace. Repeated creation must not duplicate workspace; unknown email/expired verification fails.
5. Password reset and invitation flows, unauthenticated and cross-tenant denial, browser 320/390/834/1280/1440.
6. Capture 40 private authenticated staff screenshots. Do not put passwords, emails, sessions or customer screenshots into public CI.
7. Separate owner approval and provider receipts are required before enabling unrestricted public signup.

Passing CI typecheck, tests, build, or SQL existence checks is NOT proof of email delivery or end-to-end operational readiness.
