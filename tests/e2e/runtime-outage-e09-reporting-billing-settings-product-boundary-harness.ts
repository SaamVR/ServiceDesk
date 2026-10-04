import { ok as assert } from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
const root = process.cwd();
const s = (p: string) => readFileSync(join(root, p), "utf8");
async function main() {
  assert(!s("src/features/reports/ReportsPreview.tsx").includes("sample-data"), "ReportsPreview owns no sample data");
  assert(s("src/features/reports/ReportsFixturePreview.tsx").includes("fixtureReportingSnapshot"), "reports fixture wrapper owns showcase values");
  assert(!s("src/features/billing/PlatformBillingPreview.tsx").includes("PlatformPlanFixture"), "PlatformBillingPreview owns no local plan fixture");
  assert(s("src/features/billing/PlatformBillingFixturePreview.tsx").includes("providerMode: \"SANDBOX\""), "billing fixture labels sandbox explicitly");
  assert(!s("src/features/settings/OwnerSettingsPreview.tsx").includes("rateVersion"), "OwnerSettingsPreview must not invent rateVersion");
  assert(!s("src/features/settings/OwnerSettingsPreview.tsx").includes("email"), "OwnerSettingsPreview must not expose invitation email");
  assert(s("src/features/reports/server-boundary.ts").includes("readReportingSnapshot(ctx: ActorContext, query: ReportingSnapshotQuery)"), "reporting exact read signature");
  assert(s("src/features/billing/server-boundary.ts").includes("readPlatformBillingSnapshot(ctx: ActorContext)"), "platform billing exact read signature");
  assert(s("src/features/settings/server-boundary.ts").includes("readOwnerSettingsSnapshot(ctx: ActorContext)"), "owner settings exact read signature");
  assert(s("src/features/onboarding/view-models.ts").includes("SANDBOX, BLOCKED, DEGRADED, REAUTH_REQUIRED"), "onboarding does not falsely claim live readiness");
  for (const path of ["src/features/reports/server-boundary.ts", "src/features/billing/server-boundary.ts", "src/features/settings/server-boundary.ts"]) { const file = s(path); assert(!file.includes("Repository"), `${path} must not import repositories`); assert(!file.includes("@/server/integrations"), `${path} must not import providers`); assert(!file.toLowerCase().includes("stripe"), `${path} must not import Stripe/provider clients`); }
  const routes = s("src/features/operations/staff-modules.ts") + s("src/features/operations/customer-modules.ts") + s("src/features/operations/crew-modules.ts") + s("src/features/operations/business-modules.ts");
  for (const marker of ["reports", "billing", "settings", "invoices", "quality", "automations", "inbox", "customers", "schedule", "job", "enquire", "book"]) assert(routes.includes(marker), `route coverage marker ${marker} preserved`);
  console.log("runtime-outage-e09-reporting-billing-settings-product-boundary-harness PASS");
}
main().catch((error) => { console.error(error); process.exit(1); });
