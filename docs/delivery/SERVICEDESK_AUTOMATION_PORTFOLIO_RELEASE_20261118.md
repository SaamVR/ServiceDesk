# ServiceDesk business-automation portfolio release

Status: **source candidate, NOT deployed, NOT validated by production build/browser.** This is a presentation-only release plan, not operational acceptance or permission to deploy.

## Intended experience

- Source: \`feat/servicedesk-automation-portfolio-case-study-20261118\`, draft PR #918, stacked on draft PR #915; must review/validate exact final head before deployment.
- Public hero: \`/\` (approved professional marketing design preserved).
- Main portfolio case study: \`/work/business-automation\` (five selectable workflow stages, trigger/system/human gate, architecture notes, explicit prototype boundaries).
- Interactive browser sandbox: \`/sandbox\` (local sample state only; refresh resets; no real payments, messages, database or API writes).
- Guided examples: \`/tour\` and static product pages.
- Portfolio-mode primary navigation intentionally omits \`/auth/sign-in\`, pricing and integrations links. It displays Case study / Product tour / Interactive demo.

## Environment policy for a separate, approved portfolio deployment

- Set server environment \`SERVICEDESK_PORTFOLIO_MODE=true\` at BUILD TIME.
- Keep registration disabled: \`SERVICEDESK_OWNER_REGISTRATION_ENABLED=false\`, \`SERVICEDESK_OWNER_REGISTRATION_QA_ENABLED=false\`, and DO NOT set \`SERVICEDESK_OWNER_REGISTRATION_TENANT_AUTHZ_APPROVED=true\`.
- Keep \`SERVICEDESK_F23_OWNER_HOLD_RELEASE_ENABLED=false\` and \`SERVICEDESK_F23_ATOMIC_RELEASE_APPROVED=false\`.
- Retain \`SERVICEDESK_PUBLIC_INDEXING_ENABLED=false\` until explicit approval to index.
- Use no private Supabase service-role keys, SMTP keys, AI provider credentials, payment keys or customer identities. The portfolio route and /sandbox require none.
- \`vercel.json\` intentionally has \`git.deploymentEnabled=false\`. Do not enable implicit Git-connected automatic deployments.
- This flag changes public navigation and marketing CTA only; **it is not an application-wide auth/API allowlist**. Deep operational routes remain under existing server-side guards. Audit them before wider publication.
- Vercel provider team, specific project, exact SHA, preview/staging/production audience, cost/plan and rollback need separate explicit owner authorization before any deployment.
- Any commercial portfolio usage must comply with current Vercel plan terms. Never silently upgrade.

## Required go/no-go before public sharing

1. Review PR #918 changed paths against its nominated base. No unapproved code, operations, database, security or provider changes.
2. In an approved cloud runtime with source access: \`pnpm install --frozen-lockfile\`, \`pnpm typecheck\`, \`pnpm exec eslint src/app/work/business-automation/page.tsx src/features/product/AutomationCaseStudy.tsx src/components/shell/MarketingShell.tsx src/components/shell/MarketingNavLinks.tsx src/features/product/BrightHomeExperience.tsx src/app/page.tsx\`, \`pnpm build\`.
3. With \`SERVICEDESK_PORTFOLIO_MODE=true\`, inspect desktop/mobile headers and links. Home should lead to tour and case study; top-right CTA should say Interactive demo rather than registration; never expose signup as primary call to action.
4. Test \`/work/business-automation\` keyboard/pressable stage selectors, focus, contrast, 320px and tablet widths, \`prefers-reduced-motion\`; test \`/sandbox\` completed and failure/retry sequences.
5. Verify any public server/API endpoints and anonymous routes against existing protection, including deep links outside the portfolio. No client-only gate stands in for auth.
6. If an authorized deployment exists, read back \`/health\` and host-side build SHA, test real URL navigation, guard against API/provider secrets, document rollback, and only then share the link.
7. Do not represent source prototypes as live SaaS. P02/P03/P12 remain open independently of this portfolio.

## Current evidence

- Authenticated connected GitHub exact source: portfolio draft PR #918.
- Static source audit: all case-study CSS module class references resolved, 5/5 stage selectors found, both desktop/mobile public links found, sample/no-payment disclosures found, and new PR paths isolated from database/provider code.
- Local cloud Runtime \`git ls-remote https://github.com/SaamVR/ServiceDesk.git\` FAILED with \`Could not resolve host: github.com\`. No TypeScript/build/browser/CI PASS is claimed.
- No deployment, migrations, Auth users, payments, provider calls, customer sends or canonical merges performed.
