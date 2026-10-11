# V3 owner first login: database-verified onboarding fallback

Purpose: Prevent successful QA registration from landing on the full operational dashboard when the isolated preview lacks a verified server-only operational credential.

Source:
- After the atomic owner bootstrap RPC succeeds, route the owner to /onboarding/verified?workspace=<canonical-url-encoded-slug>.
- This GET route requires a real Supabase session and confirmed email, queries only authenticated RLS-scoped OWNER memberships and workspace records, checks both immutable membership workspace ID and exact slug, and makes no service-role calls. It cannot create memberships or impersonate owners.
- /auth/continue and multi-workspace chooser send OWNERS to that verified page only when the server-only service role setting is absent. CREW and DISPATCHER navigation is unchanged.
- When a server-only operational key is present, the normal staff routes remain in effect. A key's mere presence is not sufficient evidence of functional operations and requires live browser verification.
- The verified welcome displays authoritative business name, slug, timezone and currency from Supabase, not fixtures; explicitly discloses whether the full operational backend is configured.

Limits: This is a safe first-login visibility fix, not actual SMTP acceptance and not a replacement for configuring the ServiceDesk operational service credential. The production dashboard still uses server-only authorization and must pass separate tenant isolation and real connected actions.

Acceptance:
1. QA signup with consented owner inbox -> real confirmation -> owner RPC -> this page -> real business details.
2. Sign out/sign in; if preview lacks operations key, resolve back to this page.
3. Unauthorized, unverified, malformed or different-tenant slug gets no data.
4. Confirm operational backend eventually opens the real overview and all staff routes without fixture fallbacks.
5. Keep V4 frontend branch separate; integrate only with exact-base checked PR and accepted CI.
