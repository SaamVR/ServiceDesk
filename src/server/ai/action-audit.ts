import type { AiToolOrchestrationRejectReason } from "./tool-orchestration";

export interface AiToolResultSummary {
  toolName: string;
  outcome: "PROPOSED" | "COMPLETED" | "BLOCKED" | "FAILED";
  evidenceRef?: string;
  summary: string;
}
export interface AiBlockedActionSummary {
  name: string;
  reason: AiToolOrchestrationRejectReason | string;
}
export interface AiActionAuditInput {
  workspaceId: string;
  conversationId: string;
  messageId: string;
  model: string;
  promptVersion: string;
  toolResults: AiToolResultSummary[];
  blockedActions: AiBlockedActionSummary[];
  privateReasoning?: string;
  capturedAt: string;
}
export interface AiActionAuditRecord {
  workspaceId: string;
  conversationId: string;
  messageId: string;
  model: string;
  promptVersion: string;
  capturedAt: string;
  toolResults: AiToolResultSummary[];
  blockedActions: AiBlockedActionSummary[];
  blockedActionCount: number;
  /** Raw tool outcome COMPLETED is not a persisted transaction receipt. */
  unverifiedCompletionClaims: number;
  completionEvidenceVerified: false;
  privateReasoningStored: false;
  canMutateBusinessTruth: false;
}

// AI, provider and rejected-tool strings are untrusted, even in an "audit".
// Keep stable business event IDs but do not copy unrecognized model content
// or unsafe evidence references into owner-visible diagnostics.
const SAFE_IDENTIFIER=/^[A-Za-z0-9:_-]{1,128}$/;
const SAFE_LABEL=/^[A-Za-z][A-Za-z0-9_-]{0,63}$/;
const SAFE_MODEL=/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,95}$/;
const SAFE_EVIDENCE=/^[A-Za-z][A-Za-z0-9_-]{1,39}:[A-Za-z0-9:_-]{2,96}$/;
const SECRET_LIKE=/(?:^|[:_-])(?:sk[-_](?:live|test|proj)?|whsec_|gh[pousr]_|AIza|bearer)[A-Za-z0-9_-]{3,}/i;
const OUTCOMES=new Set(["PROPOSED","COMPLETED","BLOCKED","FAILED"]);
const REJECT_REASONS=new Set<AiToolOrchestrationRejectReason>([
  "TOOL_BUDGET_EXCEEDED","BUSINESS_TRUTH_TOOL_BLOCKED","UNKNOWN_TOOL",
  "RESOURCE_OUT_OF_SCOPE","HANDOVER_ACTIVE","SCHEMA_VIOLATION",
]);
const safeId=(v:unknown)=>typeof v==="string" && SAFE_IDENTIFIER.test(v) &&
  !SECRET_LIKE.test(v)?v:"redacted-id";
const safeLabel=(v:unknown)=>typeof v==="string" && SAFE_LABEL.test(v) &&
  !SECRET_LIKE.test(v)?v:"unknown";
const safeModel=(v:unknown)=>typeof v==="string" && SAFE_MODEL.test(v) &&
  !SECRET_LIKE.test(v)?v:"unverified";
function redact(value:unknown):string {
  if(typeof value!=="string")return "No verified tool summary";
  return value.slice(0,1024)
    .replace(/Bearer\s+[^\s,;]+/gi,"[redacted-secret]")
    .replace(/(?:sk[-_](?:live|test|proj)?[-_]?|whsec_|gh[pousr]_|AIza)[A-Za-z0-9_\-]{6,}/gi,"[redacted-secret]")
    .replace(/[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}/g,"[redacted-email]")
    .replace(/(?:\+?\d[\d\s()\-.]{8,}\d)/g,"[redacted-contact]")
    .replace(/https?:\/\/\S+/gi,"[redacted-url]")
    .replace(/(?:chain of thought|private reasoning)/gi,"private reasoning")
    .slice(0,240);
}
function safeTime(v:unknown):string {
  if(typeof v!=="string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(v))return "unverified-time";
  const at=Date.parse(v);
  return Number.isFinite(at) && new Date(at).toISOString()===v?v:"unverified-time";
}
/** Do not execute model/provider getters when preparing an owner audit. */
function verifiedPlainAuditRow(value: unknown): boolean {
  try {
    return !!value && typeof value==="object" && !Array.isArray(value) &&
      Object.getPrototypeOf(value)===Object.prototype &&
      Object.getOwnPropertyNames(value).length===Object.keys(value).length &&
      Object.getOwnPropertySymbols(value).length===0 &&
      Object.values(Object.getOwnPropertyDescriptors(value))
        .every(desc=>Object.hasOwn(desc,"value"));
  } catch { return false; }
}
export function buildAiActionAuditRecord(input: AiActionAuditInput): AiActionAuditRecord {
  const tools=Array.isArray(input?.toolResults)
    ? input.toolResults.slice(0,64).map(item=>verifiedPlainAuditRow(item)
      ? item : {toolName:"unknown",outcome:"BLOCKED" as const,
        summary:"Unverified tool evidence"}) : [];
  const blocked=Array.isArray(input?.blockedActions)
    ? input.blockedActions.slice(0,64).map(item=>verifiedPlainAuditRow(item)
      ? item : {name:"unknown",reason:"SCHEMA_VIOLATION"}) : [];
  const unverifiedCompletionClaims=tools.filter(item=>item?.outcome==="COMPLETED").length;
  return {
    workspaceId:safeId(input?.workspaceId),
    conversationId:safeId(input?.conversationId),
    messageId:safeId(input?.messageId),
    model:safeModel(input?.model),
    promptVersion:safeModel(input?.promptVersion),
    capturedAt:safeTime(input?.capturedAt),
    toolResults:tools.map(item=>({
      toolName:safeLabel(item?.toolName),
      // This generic projection has not reloaded any authoritative saved
      // workflow/tool receipt. Model "COMPLETED" is therefore a pending
      // proposal, never a certificate that an external action happened.
      outcome:item?.outcome==="COMPLETED"?"PROPOSED" as const:
        OUTCOMES.has(item?.outcome)?item.outcome:"BLOCKED" as const,
      ...(item?.outcome!=="COMPLETED" &&
         typeof item?.evidenceRef==="string" && SAFE_EVIDENCE.test(item.evidenceRef) && !SECRET_LIKE.test(item.evidenceRef)
        ? {evidenceRef:item.evidenceRef}:{}),
      summary:item?.outcome==="COMPLETED"
        ? "Unverified completion claim. Inspect saved execution evidence."
        : redact(item?.summary),
    })),
    blockedActions:blocked.map(item=>({
      name:safeLabel(item?.name),
      reason:REJECT_REASONS.has(item?.reason as AiToolOrchestrationRejectReason)
        ? item.reason:"SCHEMA_VIOLATION",
    })),
    blockedActionCount:blocked.length,
    unverifiedCompletionClaims,
    completionEvidenceVerified:false,
    privateReasoningStored:false,
    canMutateBusinessTruth:false,
  };
}
