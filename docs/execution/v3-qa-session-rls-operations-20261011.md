# ServiceDesk QA session-RLS operations preview

This is a staging-only alternative to the service-role-backed operations client. It does NOT provide credentials, enable public signups, fake provider connections, or bypass authorization.

## Required operator switches, isolated Render only

- SERVICEDESK_OPERATIONS_RLS_PREVIEW_ENABLED=true
- SERVICEDESK_OWNER_REGISTRATION_QA_ENABLED=true
- SERVICEDESK_OWNER_REGISTRATION_ENABLED=false
- Verified Supabase signed-in owner/dispatcher session and migrated schema through 0059.

Without an operational service role all three exact flags are required. Otherwise full operational pages remain unavailable and the verified owner welcome page remains safe.

## Security and limits

- First call Supabase Auth getUser() from HTTP-only SSR cookie-backed client; reject missing session.
- Reuse exactly that authenticated client for QA table reads, RPC actions, workspace and membership checks; RLS applies to every call and no elevated key is sent to clients.
- Existing OWNER/DISPATCHER membership, branch checks and tenant boundaries remain mandatory.
- Full operational service role, when configured, retains precedence and current server-only elevated service client after independent actor validation.
- DB audit on 2026-10-11: all 21 core operational tables present, authenticated SELECT grants true, RLS enabled.
- Not all commands or integrations have been verified with this lower-privilege transport. Failed reads cause an error; feature is experimental QA, not certified operations.
- Never enable this in production or with unrestricted public registration.

## Outstanding real acceptance

1. Real invited-owner signup, confirmed email callback, workspace creation, still not observed.
2. Enter authenticated operations overview; verify live table reads, empty state, real tenant isolation.
3. Create synthetic customer/request; verify committed database write plus RLS; errors are blockers.
4. Sign out, unknown slug, cross-tenant and stale token must deny.
5. Capture 40 private authenticated staff screenshots and verify providers separately before live rollout.

Existing sandbox remains client-local. No synthetic accounts or transactions are automatically generated.
