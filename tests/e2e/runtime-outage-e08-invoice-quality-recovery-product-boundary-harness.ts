import { ok as assert } from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
const root = process.cwd();
function source(path: string) { return readFileSync(join(root, path), "utf8"); }
function assertNoForbidden(path: string) { const file = source(path); assert(!file.includes("@/server/integrations"), `${path} must not import provider adapters`); assert(!file.includes("src/server/core/repositories"), `${path} must not import Core repositories`); assert(!file.includes("new Repository"), `${path} must not instantiate repositories`); assert(!file.toLowerCase().includes("stripe"), `${path} must not import payment provider clients`); }
async function main() {
  const qualityPreview = source("src/features/quality/QualityReviewPreview.tsx");
  assert(!qualityPreview.includes("sample-data"), "QualityReviewPreview must not import sample-data");
  assert(!qualityPreview.includes("sampleQualityCase"), "QualityReviewPreview must not own local sample quality case");
  assert(qualityPreview.includes("QualityCaseDTO"), "QualityReviewPreview must consume QualityCaseDTO");
  assert(qualityPreview.includes("acceptedActionHandler"), "QualityReviewPreview must expose optional accepted action handler boundary");
  const qualityView = source("src/features/quality/view-models.ts");
  assert(!qualityView.includes("QualityCaseFixture"), "quality view model must not define fixture business truth");
  assert(qualityView.includes("qualityCase: QualityCaseDTO"), "quality view model must consume QualityCaseDTO");
  assert(!qualityView.includes('dataSource: "FIXTURE_UI_ONLY"'), "quality reusable view must not hard-code fixture data source");
  assert(source("src/features/quality/QualityReviewFixturePreview.tsx").includes("sampleQualityCase"), "quality fixture wrapper alone owns showcase quality case");
  const recoveryPreview = source("src/features/recovery/RecoveryActionsPreview.tsx");
  assert(!recoveryPreview.includes("sampleAttentionItems"), "RecoveryActionsPreview must not import sample attention");
  assert(!recoveryPreview.includes("sampleIntegrations"), "RecoveryActionsPreview must not import sample integrations");
  assert(!recoveryPreview.includes("recoveryFixtures"), "RecoveryActionsPreview must not own recoveryFixtures");
  assert(recoveryPreview.includes("attentionItems: AttentionItemDTO[]"), "RecoveryActionsPreview must consume authoritative attention props");
  assert(source("src/features/recovery/RecoveryActionsFixturePreview.tsx").includes("sampleAttentionItems"), "Recovery fixture wrapper may own showcase attention");
  const invoiceBoundary = source("src/features/invoices/server-boundary.ts");
  assert(invoiceBoundary.includes("applyManualPayment(ctx: ActorContext, invoiceId: string, input: ManualPaymentInput, meta: CommandMeta)"), "manual payment boundary must match exact Core signature");
  assert(invoiceBoundary.includes("commands.applyManualPayment(input.ctx, input.invoice.id, input.payment"), "manual payment must delegate exactly once to injected command");
  assert(!invoiceBoundary.includes("balanceMinor ="), "manual payment must not optimistically mutate balance");
  assert(invoiceBoundary.includes('role === "CUSTOMER"'), "customer manual payment must be disabled by Product rules");
  const qualityBoundary = source("src/features/quality/server-boundary.ts");
  assert(qualityBoundary.includes("applyQualityCaseAction(ctx: ActorContext, id: string, action: QualityCaseAction, input: QualityCaseActionInput, meta: CommandMeta)"), "quality boundary must match exact Core signature");
  assert(qualityBoundary.includes("expectedVersion: input.qualityCase.version"), "quality expectedVersion must propagate");
  assert(!qualityBoundary.includes("qualityCase.state ="), "quality action must not optimistically mutate quality state");
  const snapshot = source("src/features/operations/workspace-snapshot-boundary.ts");
  for (const collection of ["snapshot.invoices", "snapshot.recurrenceRules", "snapshot.visitEvidence", "snapshot.visitChecklistItems", "snapshot.attentionItems", "snapshot.qualityCases"]) assert(snapshot.includes(collection), `expanded snapshot mapper must consume ${collection}`);
  assert(snapshot.includes("WORKSPACE_MISMATCH"), "snapshot mapper must reject cross-workspace data");
  const operational = source("src/features/operations/OperationalRoute.tsx");
  for (const marker of ["BusinessPanel", "CustomerPanel", "StaffPanel", "CrewPanel", "OnboardingPanel", "TourPanel", "StaffInvoiceOperationalPreview", "QualityReviewPreview", "RecoveryActionsPreview", "QualityReviewFixturePreview", "RecoveryActionsFixturePreview", "ReportsPreview", "OwnerSettingsPreview"]) assert(operational.includes(marker), `OperationalRoute must preserve ${marker}`);
  const actionState = source("src/features/operations/action-state.ts");
  for (const status of ["invoice_not_found", "invoice_paid", "invoice_void", "amount_mismatch", "currency_mismatch", "quality_state_conflict", "quality_resolution_required", "version_conflict", "auth_required"]) assert(actionState.includes(status), `action-state must include ${status}`);
  for (const path of ["src/features/invoices/server-boundary.ts", "src/features/quality/server-boundary.ts", "src/features/quality/QualityReviewPreview.tsx", "src/features/recovery/RecoveryActionsPreview.tsx", "src/features/operations/workspace-snapshot-boundary.ts", "src/app/app/[workspace]/invoices/server-actions.ts", "src/app/app/[workspace]/quality/server-actions.ts", "src/app/app/[workspace]/automations/server-actions.ts", "src/app/portal/invoices/[id]/server-actions.ts"]) assertNoForbidden(path);
  console.log("runtime-outage-e08-invoice-quality-recovery-product-boundary-harness PASS");
}
main().catch((error) => { console.error(error); process.exit(1); });
