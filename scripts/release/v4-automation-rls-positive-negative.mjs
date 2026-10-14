/**
 * Optional owner-session RLS acceptance gate. Proves one persisted, matched LIVE
 * QUOTE_ACCEPTED execution -> SUCCEEDED internal action -> saved attention
 * in each owner's own branch. Three unrelated rows do NOT establish a chain.
 * No elevated client, test accounts, writes, replay, or external delivery.
 */
export const automationProofTables = Object.freeze([
  "workflow_executions", "workflow_action_executions", "attention_items",
]);
const safe = name => name.toUpperCase().replace(/[^A-Z0-9_]/g, "");

const isRow = (row, owner) => row && row.workspace_id === owner &&
  typeof row.id === "string" && row.id.length > 0;

export async function verifyTwoTenantAutomationRls(actor, foreign, fail) {
  if (!actor?.client || !actor.id || !foreign?.id || actor.id === foreign.id ||
      !actor.userId || !foreign.userId || actor.userId === foreign.userId) {
    fail("DISTINCT_AUTOMATION_OWNERS_REQUIRED");
    return;
  }

  // An empty foreign result on a table that contains no data is vacuous.
  // Always require a complete own causal chain as well.
  for (const table of automationProofTables) {
    const cross = await actor.client.from(table).select("workspace_id")
      .eq("workspace_id", foreign.id).limit(1);
    if (cross.error || !Array.isArray(cross.data) || cross.data.length !== 0) {
      fail("FOREIGN_AUTOMATION_ROW_EXPOSED_" + safe(table));
      return;
    }
  }

  // Bound reads: never enumerate customer details or unbounded event histories.
  const executions = await actor.client.from("workflow_executions")
    .select("id,workspace_id,branch_id,mode,event_type,matched,state")
    .eq("workspace_id", actor.id).eq("mode", "LIVE")
    .eq("event_type", "QUOTE_ACCEPTED").eq("matched", true)
    .order("created_at", { ascending: false }).limit(100);
  if (executions.error || !Array.isArray(executions.data)) {
    fail("OWN_AUTOMATION_EXECUTION_READ_UNVERIFIED");
    return;
  }
  const candidates = executions.data.filter(x => isRow(x, actor.id) &&
    typeof x.branch_id === "string" && x.branch_id.length > 0 &&
    x.mode === "LIVE" && x.matched === true && x.event_type === "QUOTE_ACCEPTED" &&
    (x.state === "COMPLETED" || x.state === "ACTIONS_PENDING"));
  if (candidates.length === 0) {
    fail("MISSING_OWN_LIVE_QUOTE_ACCEPTED_EXECUTION");
    return;
  }

  for (const execution of candidates) {
    const actions = await actor.client.from("workflow_action_executions")
      .select("id,workspace_id,branch_id,execution_id,action_type,state")
      .eq("workspace_id", actor.id).eq("branch_id", execution.branch_id)
      .eq("execution_id", execution.id).eq("action_type", "CREATE_ATTENTION")
      .eq("state", "SUCCEEDED").limit(10);
    if (actions.error || !Array.isArray(actions.data)) {
      fail("OWN_AUTOMATION_ACTION_READ_UNVERIFIED");
      return;
    }
    if (!actions.data.some(action => isRow(action, actor.id) &&
        action.branch_id === execution.branch_id &&
        action.execution_id === execution.id &&
        action.action_type === "CREATE_ATTENTION" && action.state === "SUCCEEDED")) continue;

    const saved = await actor.client.from("attention_items")
      .select("id,workspace_id,resource_type,resource_id,type")
      .eq("workspace_id", actor.id).eq("resource_type", "workflow_execution")
      .eq("resource_id", execution.id).eq("type", "WORKFLOW_RULE").limit(1);
    if (saved.error || !Array.isArray(saved.data)) {
      fail("OWN_AUTOMATION_ATTENTION_READ_UNVERIFIED");
      return;
    }
    if (saved.data.some(item => isRow(item, actor.id) &&
        item.resource_type === "workflow_execution" &&
        item.resource_id === execution.id && item.type === "WORKFLOW_RULE")) {
      return; // Verified causally linked own-workspace data, not external delivery.
    }
  }
  fail("MISSING_OWN_SUCCEEDED_ATTENTION_CHAIN");
}
