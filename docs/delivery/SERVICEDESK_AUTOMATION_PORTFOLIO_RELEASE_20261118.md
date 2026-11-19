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

## Vercel deployment attempt — 2026-11-18 (verified)

**Release target is a single existing reusable project:** `servicedesk-automation-portfolio` on Vercel team `Samvrc` (`team_SwFPLhTkG0XpAX3RQ8B4vbLt`), Vercel project ID `prj_DS77yz73Kp69m69BIRSce8xNs6EW`. Connected Git repository: `SaamVR/ServiceDesk`. Production branch remains `main` at provider level. No automatic preview was created on Git linking.

**Requested exact source:** `6ae2eee9c3c4e54f39788a28106cae943cb6f296` on branch `feat/servicedesk-automation-portfolio-case-study-20261118` (code tip before this operational documentation update).

**Implemented provider settings:**
- Framework Next.js; Node.js 22.x.
- Portfolio flag plus six additional safety variables installed for production, preview and development. Public registration disabled (including QA mode and tenant-auth approval), F23 holds disabled, public indexing disabled.
- Vercel project retains its default Vercel Auth / SSO protection `all_except_custom_domains`. Do not represent a resulting URL as public until access is reviewed.
- Rejected Pro-only project deployment-policy attempt with `403 pro_plan_required`; no plan upgrade or cost incurred.
- Applied documented Hobby-supported project Ignored Build Step guard: proceed only when `VERCEL_GIT_COMMIT_REF` matches the portfolio branch; skip other branches. The portfolio source itself retains `vercel.json` with `git.deploymentEnabled=false`; no Git auto-deploy is intended. Re-audit guard behavior on an actual deployment.

**Blocked attempt:** Explicit create-deployment with Git source `SaamVR/ServiceDesk`, exact pinned SHA, target `production`, existing project ID returned **Vercel HTTP 402** `api-deployments-free-per-day`, limit over 100 API deployments/day, `retryAfter:86400` seconds. This is a **platform quota** failure, not a Next.js build failure. No build began and no deployment URL exists. No retry storm. Native CLI fallback unavailable in cloud runtime (`vercel` executable absent and cloud DNS cannot resolve GitHub); prohibited samai/samvr/local/self-hosted runner fallback not used.

**Verified final state:** Vercel project `live:false`, `latestDeployment:null`, zero deployment records; seven configured environment-variable keys present. The deployment target is **NOT LIVE**.

**Resumption after provider quota permits:**
1. Confirm Vercel limits and team plan. Hobby supports **personal/non-commercial only**. A publicly promoted commercial/freelance lead-generation site must use an authorized compliant plan; no automatic paid upgrade.
2. Check source / PR #918 exact head, review portfolio-only source and build/QA; restore any unavailable CI evidence without claiming green.
3. Deploy the exact reviewed code SHA to the **same existing project** via manual API/CLI, with portfolio-mode environment, no extra Vercel project and no unauthorized third-party calls.
4. Validate actual Vercel build events, `/health`, `/`, `/work/business-automation`, `/tour`, `/sandbox`, mobile interactions, auth denial and provider safety. If protected, give a Vercel-authenticated URL, not a public-sharing claim.
5. Preserve a single stable project domain for later approved updates. Each Vercel update creates an immutable deployment internally; **do not create another project**. Record the exact build SHA, live alias, rollback and issue receipt.
