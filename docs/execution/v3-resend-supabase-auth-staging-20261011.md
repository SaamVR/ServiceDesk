# ServiceDesk V3 — Resend sender + Supabase Auth setup (staging)

Updated: 2026-10-11. Status: **EMAIL_PROVIDER_CONNECTED / SMTP_NOT_WIRED / SIGNUP_DISABLED**.

## Provider evidence

An authorized Resend connection was used to inspect sending-domain metadata.
At least one sending domain reports **verified**, with both DKIM and SPF
verification and **sending enabled**. Account email tracking is disabled for
that domain. This is evidence of *domain capability*, **not** of an active
Supabase SMTP integration or delivered ServiceDesk confirmation email.

**Owner approval 2026-10-11:** The owner explicitly approved using
**`no-reply@ezcomo.shop`** as the temporary ServiceDesk staging sender,
with a custom ServiceDesk domain to be considered later. The connected Resend
domain `ezcomo.shop` was previously verified for sending with DKIM and SPF.
This approval applies to the sender identity only: it does **not** imply that
Supabase SMTP credentials or Auth sender settings are already installed,
nor does it authorize sending unsolicited messages.

There is an existing Resend API key visible in metadata, but the Resend
connection **does not expose its secret**. Do not duplicate other systems'
API keys, print secrets in logs, commit keys, or store them in browser code.
A dedicated **sending-only** key restricted to the approved sender domain
should be provisioned through authorized credential-management workflows.

## Required Supabase Auth settings

Supabase project: **ServiceDesk** (the specifically authorized existing
staging project). Do not change the CMS project.

**Auth → URL Configuration**

- Site URL: `https://servicedesk-v2-multilane-gate.onrender.com`
- Allowed redirect URLs: the explicit
  `https://servicedesk-v2-multilane-gate.onrender.com/auth/confirm`
  endpoint (plus any required recovery query parameter variant).
- Do not trust unvalidated request Host headers or use a localhost callback.

**Auth → SMTP Settings**

| Setting | Value |
|---|---|
| Custom SMTP | Enable for approved temporary staging sender after a scoped credential is provisioned |
| Host | `smtp.resend.com` |
| Port | `465` (implicit TLS) |
| Username | `resend` |
| Password | Dedicated domain-scoped Resend API key, in Supabase secret config only |
| Sender email | **`no-reply@ezcomo.shop`** (approved staging sender; replace at brand domain launch) |
| Sender name | `ServiceDesk AI` |

The existing public Resend integration does **not** itself update Supabase Auth
settings. The available Supabase connector lacks an Auth SMTP-management
action; project CLI access tested earlier returned a permissions error. The
configured sender and credentials must be applied in the authenticated
Supabase dashboard or via separately authorized management access. **No
SMTP configuration or transactional email delivery is asserted yet.**

**Auth → Email Templates**

Place the exact repository files into the corresponding template editors:

- **Confirm signup:** `supabase/auth-templates/confirm-signup.html`
- **Reset password:** `supabase/auth-templates/recovery.html`

Both use Supabase Go-template variables `{{ .RedirectTo }}` and
`{{ .TokenHash }}`, and send users directly to the verified server SSR
callback endpoint. This intentionally honors the public HTTPS redirect
provided by ServiceDesk server actions without relying on a stale Supabase
Site URL. Signup generates `/auth/confirm` as the redirect URL and appends
`?token_hash=...&type=email`. Recovery generates
`/auth/confirm?flow=recovery` and appends `&token_hash=...`.
**The Auth Redirect URL Allow List must still contain the expected callback
URL**, and the Site URL should still be set to the preview origin. The default `{{ .ConfirmationURL }}`
is not appropriate as a guaranteed SSR-session callback without the
explicit app-hosted token-hash flow.

Provider links:
- https://resend.com/docs/send-with-smtp
- https://resend.com/docs/send-with-supabase-smtp
- https://supabase.com/docs/guides/auth/auth-smtp
- https://supabase.com/docs/guides/getting-started/tutorials/with-nextjs
- https://supabase.com/docs/guides/auth/auth-email-templates

## Before enabling public account creation

1. The connected ServiceDesk schema must complete 0037–0059 **in order**.
   The previous migration apply at **0037** was blocked by a platform
   safety check. Do not skip or circumvent a blocked migration.
2. Confirm `public.servicedesk_register_owner_workspace` exists with
   authenticated EXECUTE permission, no anonymous EXECUTE permission,
   and the expected verified-email / idempotent-owner semantics.
3. Verify that the operational runtime has valid, server-only Supabase
   service-role credentials to load the new owner's dashboard; do not
   copy secret values into logs, the browser or the repository.
4. The owner-approved temporary sender is `no-reply@ezcomo.shop`.
   Complete Auth SMTP, Site URL, redirect allow-list and both email templates
   in the actual Supabase project's authenticated settings.
5. Use a consenting controlled test mailbox to prove a delivered signup
   email, click token-hash confirmation, create a business, confirm the
   default branch and active owner membership, and load the authenticated
   dashboard in Chromium.
6. Test a password reset link and ensure the signed-in session is properly
   replaced by the new-password flow; do not treat a 200 response as
   proof of email delivery.
7. Only after all receipts pass, turn
   `SERVICEDESK_OWNER_REGISTRATION_ENABLED=true` on the isolated Render
   preview. Keep false otherwise.

The **non-secret approved sender address** is intentionally recorded for staging
configuration. No Resend API token or provider credentials are committed.

## Release status

- Existing public Supabase URL/publishable key in Render: **configured**.
- Email auth enabled and email confirmation required: **verified via public
  Supabase Auth settings**.
- Resend sending domain **`ezcomo.shop`** and temporary `no-reply` sender: **verified domain / owner-approved sender**.
- Supabase custom SMTP integration and receipt: **NOT_CONFIGURED / UNVERIFIED**.
- Current ServiceDesk migration head: **0036** at latest verified query.
- Public registration: **DISABLED**.
