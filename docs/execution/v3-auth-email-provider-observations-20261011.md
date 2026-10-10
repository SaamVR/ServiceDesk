# ServiceDesk Auth provider — read-only checks and signup acceptance

Read-only observation as of 2026-10-11. Project scope:
`ServiceDesk` (`cpmmgivhlkfbiwzhlcey`), **not** another Supabase project.

## Public Auth settings

Queried the hosted project's public Auth settings endpoint with its
**publishable** API key (no secret credentials). Recorded these returned
configuration fields:

| Setting | Observed | Meaning |
|---|---|---|
| `disable_signup` | `false` | Supabase Auth allows signup requests |
| `external.email` | `true` | Email authentication is enabled |
| `mailer_autoconfirm` | `false` | Email confirmation is required |
| `external.anonymous_users` | `false` | Anonymous user login is disabled |
| `phone_autoconfirm` | `false` | Phone auto-confirmation is disabled |

These settings do **not** prove successful SMTP delivery or correct redirect
allow-list. They also do **not** override the separate ServiceDesk
`SERVICEDESK_OWNER_REGISTRATION_ENABLED` application release switch.

Source documentation:
- https://supabase.com/docs/guides/auth/passwords — hosted SSR uses PKCE;
  verification redirects must be explicitly allow-listed.
- https://supabase.com/docs/guides/auth/auth-smtp — Supabase's **default SMTP**
  is intended for testing only and restricts recipients to organization/team
  email addresses unless custom SMTP is configured. The SMTP mode for this
  particular project **has not been independently verified**.
- https://supabase.com/docs/reference/javascript/auth-verifyotp — code/token
  hash email verification.

## Minimum email and redirect acceptance before switching signup on

1. Read the specific Supabase project's Auth URL Configuration in the
   [Supabase dashboard](https://supabase.com/dashboard/project/cpmmgivhlkfbiwzhlcey/auth/url-configuration).
   Set the expected HTTPS Site URL and allow the callback:
   `https://servicedesk-v2-multilane-gate.onrender.com/auth/confirm`.
   Include the recovery variant if necessary.
2. Review Auth → SMTP Settings. With default SMTP, choose a controlled
   consenting test address belonging to the project's organization team;
   otherwise configure approved custom SMTP with sender authentication.
   Never expose credentials or paste them into repository files.
3. With the user-approved test mailbox, exercise signup and confirm that
   exactly the intended recipient receives the confirmation email.
   Do not treat an HTTP 200 from the signup form as email-delivery proof.
4. Open the delivered link in real Chromium. Confirm that the token is
   verified, session cookies are established, and continuation reaches the
   owner-workspace page.
5. After migration 0059 and the operational server-side credential
   configuration are verified, create a named synthetic business and test
   one-time idempotent owner bootstrap and an authenticated workspace.
6. Only then change Render's
   `SERVICEDESK_OWNER_REGISTRATION_ENABLED` to `true`.

## Current operational blockers

The database is still at migration head 0036. Migration 0037 was blocked by
the platform's safety checks; no subsequent schema migration should be
attempted out of order. Migration 0059 and the owner bootstrap RPC therefore
do not exist on the connected database.

A separate credential-readonly probe with the authorized `samvr` Supabase
CLI received a permissions failure when listing ServiceDesk API keys, so
the existing service-role secret could not be securely provisioned into
Render from that account. The published API key is correctly configured,
but **server-only** operational setup remains unavailable.

No real Auth users were created or emails dispatched by this investigation.
