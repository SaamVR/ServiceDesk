import { equal, ok as assert } from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
function source(path: string) { return readFileSync(join(root, path), "utf8"); }

function assertNoClientScheduleTruth(path: string) {
  const file = source(path);
  for (const forbidden of ["new Date(", "setDate(", "addDays", "addMonths", "RRule", "rrule", "cron", "nextOccurrenceOn ="]) {
    assert(!file.includes(forbidden), `${path} must not generate recurrence dates with ${forbidden}`);
  }
}

async function main() {
  const recurrenceServer = source("src/features/recurrence/server-boundary.ts");
  const recurrenceView = source("src/features/recurrence/view-models.ts");
  const recurrencePreview = source("src/features/recurrence/RecurrenceRulePreview.tsx");
  const propertyPreview = source("src/features/properties/PropertyRecurringPreview.tsx");
  const ownerSettings = source("src/features/settings/OwnerSettingsPreview.tsx");
  const evidenceBoundary = source("src/features/crew/field-evidence-boundary.ts");
  const actionState = source("src/features/operations/action-state.ts");

  assert(recurrenceServer.includes("createRecurrenceRule(ctx: ActorContext, input: CreateRecurrenceRuleInput, meta: CommandMeta)"), "createRecurrenceRule port must match frozen Core signature");
  assert(recurrenceServer.includes("applyRecurrenceRuleAction(ctx: ActorContext, id: string, action: RecurrenceRuleAction, meta: CommandMeta)"), "applyRecurrenceRuleAction port must match frozen Core signature");
  assert(recurrenceServer.includes("expectedVersion: input.rule.version"), "recurrence actions must propagate current rule expectedVersion");
  assert(recurrenceServer.includes("idempotencyKey: input.idempotencyKey"), "recurrence actions must pass route idempotencyKey");
  assert(recurrenceServer.includes("now: input.now"), "recurrence actions must pass server-action timestamp");
  assert(!recurrenceServer.includes("@/server/core/repositories"), "Product must not import Core repositories");
  assert(!recurrenceServer.includes("@/server/integrations"), "Product must not import provider adapters");

  for (const file of ["src/features/recurrence/view-models.ts", "src/features/recurrence/RecurrenceRulePreview.tsx", "src/features/properties/PropertyRecurringPreview.tsx", "src/features/settings/OwnerSettingsPreview.tsx"]) {
    assertNoClientScheduleTruth(file);
  }

  assert(recurrenceView.includes("nextOccurrenceLabel: rule.nextOccurrenceOn"), "view model must display authoritative nextOccurrenceOn only");
  assert(recurrenceView.includes("materializedVisits.map"), "materialized occurrence cards must come from VisitDTO[] input");
  assert(recurrenceView.includes("Customer recurrence mutation is disabled"), "customer recurrence mutation controls must stay disabled");
  assert(recurrenceView.includes("actionsInjected"), "staff actions require injected accepted server actions");
  assert(recurrencePreview.includes("Future visits are not synthesized in Product"), "preview must not synthesize future VisitDTO cards");
  assert(propertyPreview.includes("Product never calculates the next occurrence"), "customer property surface must state recurrence schedule truth boundary");
  assert(ownerSettings.includes("RecurrenceRulePreview"), "staff settings surface must include recurrence context");

  for (const status of ["recurrence_rule_not_found", "version_conflict", "auth_required", "invalid_recurrence_configuration", "completed_recurrence_rule", "skip_unavailable", "server_error"]) {
    assert(actionState.includes(status), `action-state must represent ${status}`);
  }

  assert(evidenceBoundary.includes("VisitEvidenceDTO"), "field evidence boundary must understand VisitEvidenceDTO");
  assert(evidenceBoundary.includes("VisitChecklistItemDTO"), "field evidence boundary must understand VisitChecklistItemDTO");
  assert(evidenceBoundary.includes("submitEnabled: false"), "field evidence submission must remain disabled");
  assert(evidenceBoundary.includes("FUTURE_E06_CORE_EVIDENCE"), "field evidence persistence boundary must stay explicit");

  const operationalRoute = source("src/features/operations/OperationalRoute.tsx");
  for (const required of ["BusinessPanel", "CustomerPanel", "StaffPanel", "CrewPanel", "OnboardingPanel", "TourPanel"]) {
    assert(operationalRoute.includes(required), `OperationalRoute must preserve ${required}`);
  }

  equal(recurrenceServer.includes("productActionSuccess(result.value"), true, "UI must consume authoritative returned rule only after server success");
  console.log("runtime-outage-e07-recurrence-product-boundary-harness PASS");
}

main().catch((error) => { console.error(error); process.exit(1); });
