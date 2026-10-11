# Studio OS frontend QA — executable local/isolated commands

The coordinator owns `.github/workflows/v3-ui-focused-pr.yml`, which also checks authorized workspace access. The frontend branch deliberately adopts the coordinator's exact workflow contents to avoid a concurrent modification conflict; do not overwrite the coordinator workflow when integrating W4.

## Focused UI regression (no provider calls)

```sh
pnpm install --frozen-lockfile
pnpm exec vitest run \
  tests/e2e/v3-staff-command-search.test.ts \
  tests/e2e/staff-v3-navigation.test.tsx \
  tests/e2e/v3-inbox-triage.test.ts \
  tests/e2e/v3-inbox-search.test.ts \
  tests/e2e/v3-record-directory.test.tsx \
  tests/e2e/v3-jobs-queue.test.tsx \
  tests/e2e/v3-staff-route-resilience.test.tsx \
  tests/e2e/v3-settings-context.test.ts \
  tests/e2e/v3-studio-visual-standard.test.ts \
  tests/e2e/v3-studio-dashboard.test.ts \
  tests/e2e/v3-studio-workspaces.test.ts \
  tests/e2e/v2-professional-dashboard-ui.test.ts \
  tests/e2e/v2-professional-schedule-ui.test.ts
pnpm typecheck
pnpm exec eslint \
  src/components/product/StaffAppShell.tsx \
  src/components/product/StaffCommandPalette.tsx \
  src/features/operations/StaffOverviewDashboard.tsx \
  src/features/operations/OperationalProductRoute.tsx \
  tests/e2e/v3-studio-visual-standard.test.ts \
  tests/e2e/v3-studio-dashboard.test.ts \
  tests/e2e/v3-studio-workspaces.test.ts
pnpm build
```

## Live UI visual acceptance

An owner-approved, **isolated authenticated nonproduction** preview must be traceable to the *exact* W4 SHA. Then use `tests/e2e/v3-capture-workroom.mjs` with the parameters documented in that file. Capture 8 staff routes at 320, 390, 834, 1280 and 1440 CSS pixels. Review overflow, contrast, keyboard navigation, reduced motion, focus state, read-only preview evidence and real record presentation. Keep screenshots containing customer data out of GitHub public artifacts. Never claim product/browser PASS from source assertions alone.

## Latest W4 design evidence

- `docs/design/v3-studio-product-ux-standard-20261011.md`: industry references and design tokens.
- `tests/e2e/v3-studio-*.test.ts`: acceptance-oriented source contracts.
- `src/components/product/StaffWorkspaceV3.module.css`: scoped staff UI theme.
- `src/features/operations/StaffOverviewDashboard.module.css`: Today decision hierarchy.
- `src/features/operations/OperationalProductRoute.module.css`: operational module styling.

Owner acceptance and comprehensive Next build remain separate from the coordinator's short baseline CI until executed on exact integrated SHA.
