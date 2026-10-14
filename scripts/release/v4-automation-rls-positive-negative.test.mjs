import assert from "node:assert/strict";
import { test } from "node:test";
import { verifyTwoTenantAutomationRls, automationProofTables } from "./v4-automation-rls-positive-negative.mjs";

const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const BRANCH = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const EXEC = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const OTHER = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

function actor(id, userId, options = {}) {
  const calls = [];
  return { id, userId, calls, client: { from(table) {
    const filters = [];
    let selected = "";
    const chain = {
      select(v) { selected = v; return chain; },
      eq(key, v) { filters.push([key, v]); return chain; },
      order(key, order) {
        assert.equal(key, "created_at");
        assert.deepEqual(order, { ascending: false });
        return chain;
      },
      async limit(n) {
        calls.push({ table, selected, filters, n });
        const foreign = filters.some(([k, v]) => k === "workspace_id" && v !== id);
        if (options.errorAt === table && !foreign) return { data: null, error: { code: "READ_FAIL" } };
        if (foreign) return { data: options.leak === table ? [{ workspace_id: B }] : [], error: null };
        if (table === "workflow_executions") {
          if (options.missingExecution) return { data: [], error: null };
          return { data: [{
            id: EXEC, workspace_id: id, branch_id: BRANCH,
            mode: options.preview ? "PREVIEW" : "LIVE",
            event_type: options.otherEvent ? "REQUEST_CREATED" : "QUOTE_ACCEPTED",
            matched: options.unmatched ? false : true,
            state: options.failedParent ? "PARTIAL_FAILED" : "ACTIONS_PENDING",
          }], error: null };
        }
        if (table === "workflow_action_executions") {
          if (options.noAction) return { data: [], error: null };
          return { data: [{
            id: OTHER, workspace_id: id, branch_id: options.otherBranch ? B : BRANCH,
            execution_id: options.unrelatedAction ? OTHER : EXEC,
            action_type: options.outboundAction ? "SEND_EMAIL_TEMPLATE" : "CREATE_ATTENTION",
            state: options.pendingAction ? "PENDING" : "SUCCEEDED",
          }], error: null };
        }
        if (table === "attention_items") {
          if (options.noAttention) return { data: [], error: null };
          return { data: [{
            id: OTHER, workspace_id: id, type: "WORKFLOW_RULE",
            resource_type: "workflow_execution",
            resource_id: options.unrelatedAttention ? OTHER : EXEC,
          }], error: null };
        }
        throw Error("unexpected table");
      },
    };
    return chain;
  } } };
}
const verify = (a,b) => verifyTwoTenantAutomationRls(a,b, code => { throw Error(code); });

test("requires a LIVE matched quote -> succeeded internal action -> persisted attention causal chain", async () => {
  const a = actor(A, "owner-a"), b = actor(B, "owner-b");
  await verify(a,b);
  await verify(b,a);
  assert.deepEqual(automationProofTables,
    ["workflow_executions","workflow_action_executions","attention_items"]);
  assert.equal(a.calls.length, 6);
  assert.deepEqual(a.calls.slice(0,3).map(x => x.table), automationProofTables);
  assert(a.calls.every(x => x.n >= 1 && x.n <= 100));
  assert(a.calls.some(x => x.table === "workflow_executions" &&
    x.filters.some(([key,v]) => key === "event_type" && v === "QUOTE_ACCEPTED")));
});

test("rejects mismatched, preview, unlinked and incomplete persisted evidence", async () => {
  const invalid = [
    "missingExecution", "preview", "otherEvent", "unmatched", "failedParent",
    "noAction", "otherBranch", "unrelatedAction", "outboundAction", "pendingAction",
    "noAttention", "unrelatedAttention",
  ];
  for (const scenario of invalid) {
    await assert.rejects(verify(actor(A, "owner-a", { [scenario]: true }), actor(B,"owner-b")),
      /MISSING_OWN_LIVE_QUOTE_ACCEPTED_EXECUTION|MISSING_OWN_SUCCEEDED_ATTENTION_CHAIN/, scenario);
  }
});

test("rejects unrelated table data and a visible foreign tenant row on every table", async () => {
  for (const table of automationProofTables) {
    await assert.rejects(verify(actor(A,"owner-a",{leak:table}),actor(B,"owner-b")),
      new RegExp("FOREIGN_AUTOMATION_ROW_EXPOSED_" + table.toUpperCase()));
  }
});

test("requires distinct authenticated owners and independent workspaces", async () => {
  await assert.rejects(verify(actor(A,"same"),actor(B,"same")), /DISTINCT_AUTOMATION_OWNERS_REQUIRED/);
  await assert.rejects(verify(actor(A,"a"),actor(A,"b")), /DISTINCT_AUTOMATION_OWNERS_REQUIRED/);
  await assert.rejects(verify(actor(A,undefined),actor(B,"b")), /DISTINCT_AUTOMATION_OWNERS_REQUIRED/);
});

test("read errors fail closed without revealing raw provider or database details", async () => {
  for (const table of automationProofTables) {
    await assert.rejects(verify(actor(A,"a",{errorAt:table}),actor(B,"b")),
      /OWN_AUTOMATION_.*READ_UNVERIFIED/);
  }
});
