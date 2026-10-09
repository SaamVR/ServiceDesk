import { createHash } from "node:crypto";
import type {
  Result,
  WorkflowActionDTO,
  WorkflowConditionDTO,
  WorkflowEventType,
  WorkflowRuleVersionDTO,
} from "../../contracts";

export type WorkflowEventScalar = string | number | boolean | null;
export type WorkflowEventValue = WorkflowEventScalar | WorkflowEventScalar[];

export interface WorkflowEventEnvelope {
  workspaceId: string;
  branchId: string;
  eventType: WorkflowEventType;
  snapshot: Record<string, WorkflowEventValue>;
  recursionDepth: number;
  parentExecutionId?: string;
}

export interface WorkflowConditionDecision {
  field: string;
  operator: WorkflowConditionDTO["operator"];
  matched: boolean;
}

export interface WorkflowActionPlan {
  index: number;
  action: WorkflowActionDTO;
  requiresOwnerApproval: boolean;
  previewOnly: boolean;
}

export interface WorkflowEvaluationPlan {
  matched: boolean;
  conditionDecisions: WorkflowConditionDecision[];
  actionPlans: WorkflowActionPlan[];
  eventFingerprint: string;
  recursionDepth: number;
}

const fieldsByEvent: Record<WorkflowEventType, readonly string[]> = {
  REQUEST_CREATED: ["request.serviceCode", "request.leadSource", "request.branchCode"],
  QUOTE_ACCEPTED: ["quote.currency", "quote.branchCode", "request.serviceCode"],
  VISIT_COMPLETED: ["visit.branchCode", "request.serviceCode", "visit.hasIncident"],
  INVOICE_PAID: ["invoice.currency", "invoice.branchCode", "request.serviceCode"],
  ATTENTION_OPENED: ["attention.type", "attention.severity", "attention.branchCode"],
};

function fail<T>(code: string, message: string): Result<T> {
  return { ok: false, code, message };
}

function scalarEqual(left: WorkflowEventScalar, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function evaluateCondition(
  condition: WorkflowConditionDTO,
  snapshot: Record<string, WorkflowEventValue>,
): WorkflowConditionDecision {
  const actual = snapshot[condition.field];
  let matched = false;

  if (condition.operator === "EQ") {
    matched = !Array.isArray(actual) && scalarEqual(actual ?? null, condition.value);
  } else if (condition.operator === "NEQ") {
    matched = Array.isArray(actual) || !scalarEqual(actual ?? null, condition.value);
  } else if (condition.operator === "IN") {
    const candidates = Array.isArray(condition.value) ? condition.value : [];
    matched = !Array.isArray(actual) && candidates.some((candidate) => scalarEqual(actual ?? null, candidate));
  }

  return { field: condition.field, operator: condition.operator, matched };
}

function stableSnapshot(snapshot: Record<string, WorkflowEventValue>): string {
  const ordered: Record<string, WorkflowEventValue> = {};
  for (const key of Object.keys(snapshot).sort()) ordered[key] = snapshot[key];
  return JSON.stringify(ordered);
}

export function validateWorkflowEventEnvelope(
  input: WorkflowEventEnvelope,
): Result<WorkflowEventEnvelope> {
  if (!input.workspaceId || !input.branchId) {
    return fail("WORKFLOW_EVENT_SCOPE_REQUIRED", "Workflow events require workspace and branch scope.");
  }
  if (!Number.isInteger(input.recursionDepth) || input.recursionDepth < 0 || input.recursionDepth > 2) {
    return fail("WORKFLOW_RECURSION_LIMIT", "Workflow recursion depth exceeds the supported limit.");
  }

  const allowed = new Set(fieldsByEvent[input.eventType] ?? []);
  if (allowed.size === 0) return fail("WORKFLOW_EVENT_TYPE_INVALID", "Workflow event type is unsupported.");

  const keys = Object.keys(input.snapshot);
  if (keys.length > 12 || keys.some((key) => !allowed.has(key))) {
    return fail("WORKFLOW_EVENT_FIELD_NOT_ALLOWED", "Workflow event contains fields outside the safe event catalogue.");
  }

  for (const value of Object.values(input.snapshot)) {
    if (Array.isArray(value)) {
      if (value.length > 20 || value.some((item) =>
        item !== null
        && typeof item !== "string"
        && typeof item !== "number"
        && typeof item !== "boolean")) {
        return fail("WORKFLOW_EVENT_VALUE_INVALID", "Workflow event value is malformed.");
      }
      continue;
    }
    if (value !== null && !["string", "number", "boolean"].includes(typeof value)) {
      return fail("WORKFLOW_EVENT_VALUE_INVALID", "Workflow event value is malformed.");
    }
    if (typeof value === "string" && value.length > 160) {
      return fail("WORKFLOW_EVENT_VALUE_INVALID", "Workflow event text exceeds the safe snapshot limit.");
    }
  }

  return { ok: true, value: input };
}

export function evaluateWorkflowRule(
  version: WorkflowRuleVersionDTO,
  event: WorkflowEventEnvelope,
  mode: "PREVIEW" | "LIVE",
): Result<WorkflowEvaluationPlan> {
  const validated = validateWorkflowEventEnvelope(event);
  if (!validated.ok) return validated;

  if (version.workspaceId !== event.workspaceId || version.branchId !== event.branchId) {
    return fail("WORKFLOW_RULE_SCOPE_MISMATCH", "Workflow rule and event scopes do not match.");
  }
  if (version.eventType !== event.eventType) {
    return fail("WORKFLOW_EVENT_TYPE_MISMATCH", "Workflow rule event type does not match the source event.");
  }
  if (mode === "LIVE" && version.state !== "PUBLISHED") {
    return fail("WORKFLOW_PUBLISHED_VERSION_REQUIRED", "Live workflow evaluation requires a published version.");
  }
  if (mode === "PREVIEW" && version.state !== "DRAFT" && version.state !== "PUBLISHED") {
    return fail("WORKFLOW_PREVIEW_VERSION_INVALID", "Only draft or published versions can be previewed.");
  }
  if (version.actions.length < 1 || version.actions.length > version.maxActionsPerEvent || version.maxActionsPerEvent > 5) {
    return fail("WORKFLOW_ACTION_CAP_INVALID", "Workflow action count exceeds the configured cap.");
  }

  const allowedFields = new Set(fieldsByEvent[event.eventType]);
  if (version.conditions.some((condition) => !allowedFields.has(condition.field))) {
    return fail("WORKFLOW_CONDITION_CATALOGUE_VIOLATION", "Workflow condition field is not allowed for this event.");
  }

  const conditionDecisions = version.conditions.map((condition) => evaluateCondition(condition, event.snapshot));
  const matched = conditionDecisions.every((decision) => decision.matched);
  const actionPlans = matched
    ? version.actions.map((action, index) => ({
        index,
        action,
        requiresOwnerApproval: action.type === "SEND_EMAIL_TEMPLATE" || action.type === "SEND_WHATSAPP_TEMPLATE",
        previewOnly: mode === "PREVIEW",
      }))
    : [];

  const eventFingerprint = createHash("sha256")
    .update([
      event.workspaceId,
      event.branchId,
      event.eventType,
      stableSnapshot(event.snapshot),
      String(event.recursionDepth),
      event.parentExecutionId ?? "",
    ].join("|"))
    .digest("hex");

  return {
    ok: true,
    value: {
      matched,
      conditionDecisions,
      actionPlans,
      eventFingerprint,
      recursionDepth: event.recursionDepth,
    },
  };
}

export function workflowExecutionKey(input: {
  mode: "PREVIEW" | "LIVE";
  ruleVersionId: string;
  eventFingerprint: string;
  previewNonce?: string;
}): string {
  if (input.mode === "PREVIEW") {
    const nonce = input.previewNonce?.trim();
    return `preview:${input.ruleVersionId}:${input.eventFingerprint}:${nonce || "default"}`;
  }
  return `live:${input.ruleVersionId}:${input.eventFingerprint}`;
}
