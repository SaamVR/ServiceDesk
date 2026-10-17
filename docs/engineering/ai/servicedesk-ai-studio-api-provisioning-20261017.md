# ServiceDesk AI Studio — API credential and runtime setup (2026-10-17)

## Verified source and identity

- Connected device `samai` has Codex CLI `0.151.0`; `codex login status` reported **Logged in using ChatGPT**.
- Redacted credential structure inspection showed `~/.codex/auth.json` with `auth_mode=chatgpt`, a `tokens` object and an empty `OPENAI_API_KEY` field; the inspected shell has no exported `OPENAI_API_KEY`.
- **Do not** repurpose personal ChatGPT/Codex OAuth access or refresh tokens as ServiceDesk production API credentials. They are personal session secrets, not project-scoped server API keys; copying one to GitHub, browser JavaScript or a deployment config is prohibited.
- Codex ChatGPT subscription authentication and standalone OpenAI API billing/credentials are distinct: see OpenAI's [official billing explanation](https://help.openai.com/en/articles/9039756-managing-billing-settings-on-the-chatgpt-web-and-api-platform) and [Codex sign-in](https://help.openai.com/en/articles/11381614-api-codex-cli-and-sign-in-with-chatgpt).

## Required provisioning

1. Open **https://platform.openai.com/api-keys** and create a dedicated project-scoped ServiceDesk key in the authorized API project. Confirm billing/project spending controls and limited secret access before paid usage; this may need a billing method separate from ChatGPT.
2. In the **authorized ServiceDesk V4 deployment** secret environment (not the older R13 Render public review), set server-only variables:

   ```dotenv
   OPENAI_API_KEY=<SET_ONLY_IN_DEPLOYMENT_SECRET_STORE>
   SERVICEDESK_AI_MODEL=gpt-4.1-mini
   SERVICEDESK_AI_ENABLED=false
   SERVICEDESK_AI_TIMEOUT_MS=20000
   SERVICEDESK_AI_MAX_OUTPUT_TOKENS=2048
   ```

   The model identifier is an operator-editable conservative example; confirm access to a current model in the chosen API project before enabling. The server restricts the API endpoint to `https://api.openai.com/v1`. `OPENAI_API_KEY` **must never** be prefixed `NEXT_PUBLIC_`.
3. Verify the secret is available on the **running server** without logging or returning its value. It is not enough to configure the old Render R13 site or authenticate a Codex CLI.
4. With owner-approved API budget and live test permission, change `SERVICEDESK_AI_ENABLED` to `true`; test via AI Studio owner-only **Test AI model connection**. One successful synthetic response verifies that model connection **only**. It does not establish invoice, message or workflow execution.
5. On a real authorized fictional workspace, explicitly generate a request brief and a quote review. Verify that prompts exclude customer identity, address, free-form notes, invoice amounts, prices and secrets, and that a draft cannot approve quotes, contact customers, mutate the database or charge money.
6. If disabled, missing credentials, model unauthorized, timeout or provider failure, staff operations continue normally without AI. Return the deployment flag to `false` to stop new model calls.

## Actual implemented AI Studio surfaces

- `/app/[workspace]/automations/ai-studio` is under an authenticated workspace layout and uses the existing authorized operational snapshot. Staff navigation shows AI Studio on desktop/mobile.
- Workbench projects **only sanitized UUID + ordinal + bounded status** into browser choices, never customer data. Request and quote tools reuse existing protected server routes and server reauthorization.
- Owner-only tools: synthetic provider connection probe and operational priorities from already-verified aggregate facts.
- Inbox reply drafts remain human-reviewed; workflow publishing, external dispatch, customer authorization and payment authority stay separate.
- Source-only CI proves implementation/contract. **Provider verification cannot be claimed without a controlled paid model response** and an authorization receipt.

## Release holds

- Main and current older R13 Render service are not automatically promoted by merging V4 source.
- Current connected Supabase staging is unconfigured for real merchant automation and still lacks SQL migration 0063. Never install migrations or create customer accounts merely to enable AI Studio.
- Do not store API credentials in GitHub Actions logs, repository source, client components, persisted quote snapshots, analytics or PR bodies. Rotate a leaked key promptly.
