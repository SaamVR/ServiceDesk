/**
 * Read-only automation acceptance: both distinct owners must have at least
 * one persisted workflow execution, action execution and internal attention.
 * A draft/published rule alone is not evidence of real automation activity.
 * No sample rows, user accounts, providers or data mutations.
 */
export const automationProofTables = Object.freeze([
  "workflow_executions",
  "workflow_action_executions",
  "attention_items",
]);
const safe = name => name.toUpperCase().replace(/[^A-Z0-9_]/g, "");

export async function verifyTwoTenantAutomationRls(actor, foreign, fail) {
  if (!actor?.client || !actor.id || !foreign?.id || actor.id === foreign.id ||
      !actor.userId || !foreign.userId || actor.userId === foreign.userId) {
    fail("DISTINCT_AUTOMATION_OWNERS_REQUIRED");
  }
  for (const table of automationProofTables) {
    // A missing own row means a cross-tenant empty result would be vacuous.
    const own = await actor.client.from(table).select("workspace_id")
      .eq("workspace_id",actor.id).limit(1);
    if (own.error || !Array.isArray(own.data) || own.data.length !== 1 ||
      own.data[0]?.workspace_id !== actor.id) {
      fail("MISSING_OWN_AUTOMATION_ROW_" + safe(table));
    }
    const cross = await actor.client.from(table).select("workspace_id")
      .eq("workspace_id",foreign.id).limit(1);
    if (cross.error || !Array.isArray(cross.data) || cross.data.length !== 0) {
      fail("FOREIGN_AUTOMATION_ROW_EXPOSED_" + safe(table));
    }
  }
}
