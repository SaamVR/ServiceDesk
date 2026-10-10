# ServiceDesk V3 — Resend sender + Supabase Auth setup (staging)

Updated: 2026-10-11. Status: **EMAIL_PROVIDER_CONNECTED / SMTP_NOT_WIRED / SIGNUP_DISABLED**.

## Provider evidence

An authorized Resend connection was used to inspect sending-domain metadata.
At least one sending domain reports **verified**, with both DKIM and SPF
verification and **sending enabled**. Account email tracking is disabled for
that domain. This is evidence of *domain capability*, **not** of an active
Supabase SMTP integration or delivered ServiceDesk confirmation email.

**Important:** A verified sending domain already present in an account must
not automatically be repurposed for ServiceDesk. The owner must select/approve
a brand-appropriate domain and sender, then have its ownership and sender
policies checked. Keep unrelated e-commerce/customer brands isolated.

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
| Custom SMTP | Enabled **after approval of dedicated sender** |
| Host | `smtp.resend.com` |
| Port | `465` (implicit TLS) |
| Username | `resend` |
| Password | Dedicated domain-scoped Resend API key, in Supabase secret config only |
| Sender email | `no-reply@<approved-verified-domain>` |
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

Both use Supabase Go-template variables `{{ .SiteURL }}` and
`{{ .TokenHash }}`, and send users directly to the verified server SSR
callback endpoint. The signup link has `type=email` and recovery uses
`flow=recovery`; do not swap them. The default `{{ .ConfirmationURL }}`
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
4. The owner approves the sender domain; complete Auth SMTP, Site URL,
   redirect allow-list and both email templates in the actual Supabase
   project's authenticated settings.
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

The Resend verified domain and existing API-key metadata were intentionally
not committed with personal account details or secrets.

## Release status

- Existing public Supabase URL/publishable key in Render: **configured**.
- Email auth enabled and email confirmation required: **verified via public
  Supabase Auth settings**.
- Verified Resend sending-domain capability: **verified**.
- Supabase custom SMTP integration and receipt: **NOT_CONFIGURED / UNVERIFIED**.
- Current ServiceDesk migration head: **0036** at latest verified query.
- Public registration: **DISABLED**.
