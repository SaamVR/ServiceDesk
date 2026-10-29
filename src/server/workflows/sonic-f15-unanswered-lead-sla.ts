import { createHash } from "node:crypto";

/**
 * F15 candidate evaluator, independent of browser state and provider APIs.
 * A source record is only a claim until the atomic port re-reads it under
 * the saved workspace/branch and source-version lock.
 */
export type F15RequestState = "NEW" | "OPEN" | "REPLIED" | "CLOSED";
export interface F15SavedLeadFacts {
  workspaceId: string;
  branchId: string;
  requestId: string;
  version: number;
  status: F15RequestState;
  createdAt: string;
  lastInboundAt: string;
  lastStaffResponseAt: string | null;
  responseHistoryComplete: true;
}
export interface F15SlaInput {
  record: F15SavedLeadFacts;
  observedAt: string;
  thresholdMinutes: number;
}
export type F15SlaDecision =
  | { ok: false; code: "F15_EVIDENCE_INVALID" | "F15_SCOPE_INVALID" | "F15_CLOCK_INVALID" }
  | { ok: true; value: {
    state: "NO_ESCALATION_DUE" | "UNPERSISTED_SLA_CANDIDATE";
    workspaceId: string; branchId: string; requestId: string;
    sourceVersion: number; sourceLastInboundAt: string;
    observedAt: string; dueAt: string; thresholdMinutes: number;
    eventKey: string; eventType: "UNANSWERED_LEAD_SLA_REVIEW";
    approvalRequired: true; durableEventRecorded: false;
    providerCalled: false; customerMessageSent: false;
    workflowExecuted: false; moneyChanged: false;
  } };

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const savedKeys = ["workspaceId","branchId","requestId","version","status",
  "createdAt","lastInboundAt","lastStaffResponseAt","responseHistoryComplete"] as const;
const inputKeys = ["record","observedAt","thresholdMinutes"] as const;

function exact(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  try {
    if (!value || typeof value !== "object" || Array.isArray(value) ||
        Object.getPrototypeOf(value) !== Object.prototype) return false;
    const names = Reflect.ownKeys(value);
    const descriptors = Object.getOwnPropertyDescriptors(value);
    return names.length === keys.length &&
      names.every(k => typeof k === "string" && keys.includes(k)) &&
      keys.every(k => Object.hasOwn(descriptors, k) &&
        Object.hasOwn(descriptors[k], "value") && descriptors[k].enumerable);
  } catch { return false; }
}
function instant(value: unknown): number | null {
  if (typeof value !== "string" || value.length !== 24 ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value))
    return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value
    ? parsed : null;
}

/**
 * Positive decision means review candidate only, not a saved source event.
 * Requires complete response history; absence of a message in a truncated
 * Inbox snapshot is NOT evidence that the request was unanswered.
 */
export function planF15UnansweredLeadSla(input: unknown): F15SlaDecision {
  if (!exact(input, inputKeys) || !exact(input.record, savedKeys))
    return {ok:false,code:"F15_EVIDENCE_INVALID"};
  const r = input.record;
  if (![r.workspaceId,r.branchId,r.requestId].every(v =>
      typeof v === "string" && uuid.test(v)) ||
      r.workspaceId === r.branchId || r.requestId === r.workspaceId ||
      r.requestId === r.branchId)
    return {ok:false,code:"F15_SCOPE_INVALID"};
  if (!Number.isSafeInteger(r.version) || (r.version as number) < 1 ||
      (r.version as number) > 2147483647 ||
      !["NEW","OPEN","REPLIED","CLOSED"].includes(r.status as string) ||
      r.responseHistoryComplete !== true ||
      !Number.isSafeInteger(input.thresholdMinutes) ||
      (input.thresholdMinutes as number) < 15 ||
      (input.thresholdMinutes as number) > 1440)
    return {ok:false,code:"F15_EVIDENCE_INVALID"};

  const created = instant(r.createdAt);
  const inbound = instant(r.lastInboundAt);
  const observed = instant(input.observedAt);
  const answered = r.lastStaffResponseAt === null ? null : instant(r.lastStaffResponseAt);
  if (created === null || inbound === null || observed === null ||
      (r.lastStaffResponseAt !== null && answered === null) ||
      created > inbound || inbound > observed ||
      (answered !== null && (answered < created || answered > observed)))
    return {ok:false,code:"F15_CLOCK_INVALID"};

  const threshold = input.thresholdMinutes as number;
  const due = inbound + threshold * 60_000;
  if (!Number.isSafeInteger(due))
    return {ok:false,code:"F15_CLOCK_INVALID"};
  // Include the LAST inbound time, but not the mutable request version, so
  // replay of the same message remains stable while a genuinely new inbound
  // after an earlier escalation can produce a distinct review event.
  const eventKey = createHash("sha256").update(JSON.stringify([
    "SONIC_F15_UNANSWERED_LEAD_SLA_V1",
    r.workspaceId, r.branchId, r.requestId, r.lastInboundAt,
  ])).digest("hex");
  const state = (r.status === "NEW" || r.status === "OPEN") &&
    (answered === null || answered < inbound) && observed >= due
    ? "UNPERSISTED_SLA_CANDIDATE" : "NO_ESCALATION_DUE";
  return {ok:true,value:{
    state,workspaceId:r.workspaceId as string,branchId:r.branchId as string,
    requestId:r.requestId as string,sourceVersion:r.version as number,
    sourceLastInboundAt:r.lastInboundAt as string,observedAt:input.observedAt as string,
    dueAt:new Date(due).toISOString(),thresholdMinutes:threshold,eventKey,
    eventType:"UNANSWERED_LEAD_SLA_REVIEW",approvalRequired:true,
    durableEventRecorded:false,providerCalled:false,customerMessageSent:false,
    workflowExecuted:false,moneyChanged:false,
  }};
}
