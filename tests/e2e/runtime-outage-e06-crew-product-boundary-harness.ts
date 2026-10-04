import { equal, ok as assert } from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
function source(path: string) { return readFileSync(join(root, path), "utf8"); }

function assertNoForbiddenImports(path: string) {
  const file = source(path);
  assert(!file.includes("@/server/core/repositories"), `${path} must not import Core repositories`);
  assert(!file.includes("src/server/core/repositories"), `${path} must not import Core repository paths`);
  assert(!file.includes("@/server/integrations"), `${path} must not import provider adapters`);
  assert(!file.includes("stripe"), `${path} must not import Stripe providers`);
  assert(!file.includes("whatsapp"), `${path} must not import WhatsApp providers`);
  assert(!file.includes("google-calendar"), `${path} must not import Calendar providers`);
}

async function main() {
  const boundary = source("src/features/crew/server-boundary.ts");
  assert(boundary.includes('ServiceDeskFacade["transitionVisit"]'), "crew port must use exact Core transitionVisit signature");
  assert(boundary.includes("commands.transitionVisit(input.ctx, input.visit.id, action, meta)"), "adapter must call transitionVisit(ctx, visitId, action, meta)");
  assert(boundary.includes('ASSIGNED: "EN_ROUTE"'), "ASSIGNED must map to EN_ROUTE");
  assert(boundary.includes('EN_ROUTE: "START"'), "EN_ROUTE must map to START");
  assert(boundary.includes('IN_PROGRESS: "SUBMIT_REVIEW"'), "IN_PROGRESS must map to SUBMIT_REVIEW");
  assert(!boundary.includes('CONFIRM: "'), "Product must not expose CONFIRM as a crew action");
  assert(!boundary.includes('ASSIGN: "'), "Product must not expose ASSIGN as a crew action");
  assert(!boundary.includes('COMPLETE: "'), "Product must not expose COMPLETE as a crew action");
  assert(!boundary.includes('CANCEL: "'), "Product must not expose CANCEL as a crew action");
  assert(boundary.includes("expectedVersion: input.visit.version"), "expectedVersion must come from current VisitDTO version");
  assert(boundary.includes("idempotencyKey: input.idempotencyKey"), "idempotencyKey must come from route action input");
  assert(boundary.includes("now: input.now"), "current timestamp must be supplied by route action context");
  assert(!boundary.includes("{ ...input.visit"), "adapter must not optimistically mutate the visit");

  const evidence = source("src/features/crew/field-evidence-boundary.ts");
  assert(evidence.includes("FUTURE_E06_CORE_EVIDENCE"), "field evidence must be marked as future Core persistence");
  assert(evidence.includes("submitEnabled: false"), "field evidence submit controls must stay disabled");

  const viewModels = source("src/features/crew/view-models.ts");
  assert(viewModels.includes("NOT_PERSISTED"), "crew view model must label checklist/evidence as non-persisted");
  assert(!viewModels.includes("complete:"), "crew checklist must not expose fake completion as business truth");

  const preview = source("src/features/crew/CrewJobPreview.tsx");
  assert(preview.includes("FIXTURE_UI_ONLY / NOT_MUTATED"), "fixture route must not pretend a mutation happened");
  assert(preview.includes("disabled={transitionDisabled}"), "CrewJobPreview must enable only supplied valid transition state");
  assert(preview.includes("Evidence submit disabled"), "evidence controls must be disabled");

  const todayBoundary = source("src/app/crew/today/server-actions.ts");
  const jobBoundary = source("src/app/crew/jobs/[id]/server-actions.ts");
  assert(todayBoundary.includes('Pick<ServiceDeskFacade, "readWorkspaceSnapshot" | "transitionVisit">'), "today route boundary must use injected facade commands");
  assert(jobBoundary.includes('Pick<ServiceDeskFacade, "readWorkspaceSnapshot" | "transitionVisit">'), "job route boundary must use injected facade commands");

  for (const path of [
    "src/features/crew/server-boundary.ts",
    "src/features/crew/field-evidence-boundary.ts",
    "src/features/crew/CrewJobPreview.tsx",
    "src/features/crew/view-models.ts",
    "src/app/crew/today/server-actions.ts",
    "src/app/crew/jobs/[id]/server-actions.ts",
  ]) assertNoForbiddenImports(path);

  const route = source("src/features/operations/OperationalRoute.tsx");
  for (const required of [
    "BusinessPanel",
    "CustomerPanel",
    "StaffPanel",
    "CrewPanel",
    "OnboardingPanel",
    "TourPanel",
    "InboxPreview",
    "CrmPreview",
    "ReportsPreview",
    "PlatformBillingPreview",
    "QualityReviewPreview",
    "RecoveryActionsPreview",
    "OwnerSettingsPreview",
    "PropertyRecurringPreview",
    "CommunicationPreferences",
  ]) assert(route.includes(required), `OperationalRoute must preserve ${required}`);

  equal(true, true);
  console.log("runtime-outage-e06-crew-product-boundary-harness PASS");
}

main().catch((error) => { console.error(error); process.exit(1); });
