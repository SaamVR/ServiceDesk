import { describe, expect, it, vi } from "vitest";
import {
  runOwnerSavedRequestAutomation,
  type OwnerRequestAutomationDependencies,
} from "../../src/server/workflows/owner-request-automation";

const workspaceId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const branchId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const requestId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const actionId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const attentionId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

function fixture(options: { role?: string; mode?: "SERVICE_ROLE" | "QA_SESSION_RLS"; missing?: boolean; pending?: boolean; duplicate?: boolean; drift?: boolean } = {}) {
  const visited: string[] = [];
  let pending = options.pending ?? true;
  const tables: Record<string, Record<string, unknown>[]> = {
    requests: options.missing ? [] : [{ id: requestId, workspace_id: workspaceId, branch_id: branchId, service_id: null, customer_id: null }],
    workspace_branches: [{ id: branchId, workspace_id: workspaceId, code: "MAIN" }],
    workflow_rules: [{ id: "rule-1", workspace_id: workspaceId, branch_id: branchId, status: "ACTIVE", published_version_number: 2 }],
    workflow_rule_versions: [{ id: "version-1", workspace_id: workspaceId, branch_id: branchId, rule_id: "rule-1", version_number: 2, state: "PUBLISHED", event_type: "REQUEST_CREATED",
      conditions: [], actions: [{ type: "CREATE_ATTENTION", severity: "WARNING", summaryKey: "REVIEW_NEW_ENQUIRY" },
        { type: "SEND_EMAIL_TEMPLATE", templateKey: "fictional", recipient: "CUSTOMER_PRIMARY" }],
      max_actions_per_event: 3, created_at: "2026-10-12T00:00:00.000Z" }],
    workflow_action_executions: [{ id: actionId, workspace_id: workspaceId, branch_id: branchId, execution_id: "execution-1", action_type: "CREATE_ATTENTION", state: "PENDING" }],
    attention_items: [{ id: attentionId, workspace_id: workspaceId }],
    workflow_executions: [{ id: "execution-1", workspace_id: workspaceId, branch_id: branchId,
      rule_version_id: "version-1", event_fingerprint: options.drift ? "stale-original-fingerprint" : "original-event-fingerprint", matched: true }],
  };
  const service = {
    from(table: string) {
      visited.push(table);
      const filters: Array<[string, unknown]> = [];
      const rows = () => (tables[table] || []).filter(row => filters.every(([key, value]) => row[key] === value))
        .filter(() => table !== "workflow_action_executions" || pending);
      const query = {
        select() { return query; },
        eq(key: string, value: unknown) { filters.push([key, value]); return query; },
        maybeSingle() { return Promise.resolve({ data: rows()[0] ?? null, error: null }); },
        limit(size: number) { return Promise.resolve({ data: rows().slice(0, size), error: null }); },
      };
      return query;
    },
  };
  const evaluateAndRecord = vi.fn(async (payload: { mode: string; event: { sourceEventId?: string } }) => {
    expect(payload.mode).toBe("LIVE");
    expect(payload.event.sourceEventId).toBe(requestId);
    return { ok: true as const, value: { executionId: "execution-1", duplicate: options.duplicate ?? false,
      state: "ACTIONS_PENDING", actionCount: 2, plan: {
        matched: true, eventFingerprint: "original-event-fingerprint",
        actionPlans: [{ requiresOwnerApproval: false }, { requiresOwnerApproval: true }],
      } } };
  });
  const executeAttentionAction = vi.fn(async () => {
    pending = false;
    return { ok: true as const, value: { actionExecutionId: actionId, attentionItemId: attentionId } };
  });
  const resolveActor = vi.fn(async () => ({ ok: true as const, value: {
    workspace: { id: workspaceId, slug: "fictional-qa" },
    actor: { userId: "owner-1", workspaceId, role: options.role ?? "OWNER" },
    branchScope: { mode: "ALL", branches: [{ id: branchId }] },
    service, rpc: {},
  } }));
  return { visited, evaluateAndRecord, executeAttentionAction, resolveActor, deps: {
    resolveActor, mode: () => options.mode ?? "SERVICE_ROLE",
    portFactory: () => ({ evaluateAndRecord, executeAttentionAction }),
  } as unknown as OwnerRequestAutomationDependencies };
}

describe("V4 owner-controlled persisted request automations", () => {
  it("executes only internal attention actions and proves readback, never queues external provider sends", async () => {
    const t = fixture();
    const outcome = await runOwnerSavedRequestAutomation("fictional-qa", requestId, t.deps);
    expect(outcome).toMatchObject({ ok: true, value: {
      state: "PERSISTED_INTERNAL_WORKFLOW_PROCESSING",
      matchedExecutions: 1, completedAttentionActions: 1, externalApprovalRequired: 1,
      providerMessagesSent: 0, replayedSourceEvent: false, newlyRecordedRuleExecutions: 1, reusedRuleExecutions: 0,
    } });
    expect(t.evaluateAndRecord).toHaveBeenCalledOnce();
    expect(t.executeAttentionAction).toHaveBeenCalledWith(workspaceId, actionId);
    expect(t.visited).toContain("attention_items");
  });

  it("resumes an identical recorded event without creating a duplicate execution", async () => {
    const t = fixture({ duplicate: true });
    const outcome = await runOwnerSavedRequestAutomation("fictional-qa", requestId, t.deps);
    expect(outcome).toMatchObject({ ok: true, value: { completedAttentionActions: 1, providerMessagesSent: 0, replayedSourceEvent: true, newlyRecordedRuleExecutions: 0, reusedRuleExecutions: 1 } });
    expect(t.visited).toContain("workflow_executions");
    expect(t.executeAttentionAction).toHaveBeenCalledOnce();
  });

  it("distinguishes completed attention replays from a fresh processed event without another action", async () => {
    const t = fixture({ duplicate: true, pending: false });
    const outcome = await runOwnerSavedRequestAutomation("fictional-qa", requestId, t.deps);
    expect(outcome).toMatchObject({ok:true,value:{
      matchedExecutions:1, completedAttentionActions:0,
      replayedSourceEvent:true, newlyRecordedRuleExecutions:0,reusedRuleExecutions:1,
      providerMessagesSent:0
    }});
    expect(t.executeAttentionAction).not.toHaveBeenCalled();
  });

  it("rejects a replay whose source facts diverge from persisted event evidence", async () => {
    const t = fixture({ duplicate: true, drift: true });
    const outcome = await runOwnerSavedRequestAutomation("fictional-qa", requestId, t.deps);
    expect(outcome).toMatchObject({ ok: false, code: "REQUEST_WORKFLOW_EVENT_DRIFT" });
    expect(t.executeAttentionAction).not.toHaveBeenCalled();
  });

  it("rejects QA session fallback without accessing privileged workflow RPCs", async () => {
    const t = fixture({ mode: "QA_SESSION_RLS" });
    expect(await runOwnerSavedRequestAutomation("fictional-qa", requestId, t.deps))
      .toMatchObject({ ok: false, code: "REQUEST_WORKFLOW_BACKEND_DISABLED" });
    expect(t.resolveActor).not.toHaveBeenCalled();
    expect(t.evaluateAndRecord).not.toHaveBeenCalled();
  });

  it("refuses dispatcher owner privilege and missing requests before any action", async () => {
    const dispatcher = fixture({ role: "DISPATCHER" });
    expect(await runOwnerSavedRequestAutomation("fictional-qa", requestId, dispatcher.deps))
      .toMatchObject({ ok: false, code: "REQUEST_WORKFLOW_OWNER_REQUIRED" });
    expect(dispatcher.evaluateAndRecord).not.toHaveBeenCalled();

    const missing = fixture({ missing: true });
    expect(await runOwnerSavedRequestAutomation("fictional-qa", requestId, missing.deps))
      .toMatchObject({ ok: false, code: "REQUEST_WORKFLOW_NOT_FOUND" });
    expect(missing.evaluateAndRecord).not.toHaveBeenCalled();
  });

  it("does not re-execute an already completed internal attention action", async () => {
    const t = fixture({ pending: false });
    const outcome = await runOwnerSavedRequestAutomation("fictional-qa", requestId, t.deps);
    expect(outcome).toMatchObject({ ok: true, value: { completedAttentionActions: 0 } });
    expect(t.executeAttentionAction).not.toHaveBeenCalled();
  });
});
