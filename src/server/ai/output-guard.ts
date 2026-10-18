import type { Result } from "../../contracts";
import type { AiRiskFlag, AssistantToolCall, CleaningRequestExtraction } from "./types";

const serviceCodes = new Set(["STANDARD", "DEEP", "MOVE_OUT"]);
const propertyKinds = new Set(["STUDIO", "APARTMENT", "HOUSE", "OFFICE"]);
const riskFlags = new Set<AiRiskFlag>([
  "MISSING_REQUIRED_FIELDS",
  "UNSUPPORTED_WORK",
  "UNSUPPORTED_AREA",
  "OVERSIZED_PROPERTY",
  "PROMPT_INJECTION",
  "CROSS_CUSTOMER_ACCESS",
  "HUMAN_HANDOVER",
  "PROVIDER_FAILURE",
]);

const forbiddenBusinessTruthFields = new Set([
  "totalMinor",
  "subtotalMinor",
  "taxMinor",
  "depositMinor",
  "balanceMinor",
  "paymentStatus",
  "paymentPaid",
  "role",
  "permission",
  "availabilityConfirmed",
  "capacityConfirmed",
  "deliveryStatus",
  "providerVerified",
]);

const allowedTools = new Set<AssistantToolCall["name"]>([
  "getServiceCatalog",
  "searchApprovedKnowledge",
  "validateServiceArea",
  "updateRequestFields",
  "calculateQuote",
  "findAvailableSlots",
  "createQuoteDraft",
  "requestHumanReview",
  "getCustomerBookingSummary",
  "proposeReschedule",
  "getBusinessMetrics",
]);

const blockedToolNames = new Set([
  "markPaymentPaid",
  "assignCrew",
  "setPrice",
  "overrideQuote",
  "confirmAvailability",
  "writeDatabase",
  "sendProviderMessage",
  "applyVerifiedPayment",
]);

const allowedExtractionFields = new Set([
  "serviceCode", "bedrooms", "bathrooms", "hasOven", "area",
  "requestedDateText", "requestedStartAt", "customerName",
  "propertyKind", "corrections", "unsupportedReasons", "riskFlags",
]);
function plainSafeObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(value))) return false;
  const d=Object.getOwnPropertyDescriptors(value);
  return Object.getOwnPropertySymbols(value).length===0 &&
    Object.getOwnPropertyNames(value).length===Object.keys(value).length &&
    Object.values(d).every(x=>Object.hasOwn(x,"value"));
}
function safeText(value:unknown,limit:number):value is string {
  return typeof value==="string" && value.length<=limit &&
    !/[\u0000-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/iu.test(value);
}
function safeDataArray(value:unknown, max:number):value is unknown[] {
  if(!Array.isArray(value) || value.length>max ||
      Reflect.ownKeys(value).length!==value.length+1) return false;
  // Include "length" only; all indexed values must be own data fields.
  for(let i=0;i<value.length;i++){
    const d=Object.getOwnPropertyDescriptor(value,String(i));
    if(!d || !Object.hasOwn(d,"value"))return false;
  }
  return true;
}
function safeToolArguments(value:unknown,depth=0):boolean {
  if(depth>4)return false;
  if(value===null || typeof value==="boolean")return true;
  if(typeof value==="string")return safeText(value,512);
  if(typeof value==="number")return Number.isFinite(value);
  if(Array.isArray(value))return safeDataArray(value,16) &&
    value.every(item=>safeToolArguments(item,depth+1));
  return plainSafeObject(value) && Object.keys(value).length<=20 &&
    Object.entries(value).every(([k,v])=>safeText(k,64) &&
      safeToolArguments(v,depth+1));
}

function stringArray(value: unknown, field: string): Result<string[]> {
  if (value === undefined) return { ok: true, value: [] };
  if (!safeDataArray(value,16) ||
      value.some((item) => !safeText(item,240))) {
    return { ok: false, code: "AI_OUTPUT_INVALID", message: `AI output field ${field} must be a string array.` };
  }
  return { ok: true, value: value as string[] };
}

function positiveInt(value: unknown, field: string): Result<number | undefined> {
  if (value === undefined) return { ok: true, value: undefined };
  if (!Number.isInteger(value) || (value as number) < 0 || (value as number) > 30) {
    return { ok: false, code: "AI_OUTPUT_INVALID", message: `AI output field ${field} must be a safe non-negative integer.` };
  }
  return { ok: true, value: value as number };
}

function forbiddenBusinessTruthField(raw: Record<string, unknown>): string | undefined {
  return Object.keys(raw).find((key) => forbiddenBusinessTruthFields.has(key));
}

export function guardAiModelOutput(value: unknown): Result<CleaningRequestExtraction> {
  if (!plainSafeObject(value)) {
    return { ok: false, code: "AI_OUTPUT_INVALID", message: "AI model output must be an object." };
  }
  const raw = value as Record<string, unknown>;
  const forbiddenField = forbiddenBusinessTruthField(raw);
  if (forbiddenField) {
    return {
      ok: false,
      code: "AI_BUSINESS_TRUTH_FORBIDDEN",
      message: `AI model output attempted to author protected business truth field ${forbiddenField}.`,
    };
  }

  // Unknown, hidden or inherited data may assert financial/provider truth
  // outside the reviewed extraction schema. Reject rather than silently omit.
  if (Object.keys(raw).some(k=>!allowedExtractionFields.has(k)) ||
      Object.keys(raw).length>allowedExtractionFields.size ||
      ["area","requestedDateText","requestedStartAt","customerName"]
        .some(k=>raw[k]!==undefined && !safeText(raw[k],240)) ||
      (raw.hasOven!==undefined && typeof raw.hasOven!=="boolean")) {
    return {ok:false,code:"AI_OUTPUT_INVALID",
      message:"AI extraction contains unapproved or unbounded fields."};
  }
  if (raw.serviceCode !== undefined && (typeof raw.serviceCode !== "string" || !serviceCodes.has(raw.serviceCode))) {
    return { ok: false, code: "AI_OUTPUT_INVALID", message: "AI output serviceCode is outside the approved catalog." };
  }
  if (raw.propertyKind !== undefined && (typeof raw.propertyKind !== "string" || !propertyKinds.has(raw.propertyKind))) {
    return { ok: false, code: "AI_OUTPUT_INVALID", message: "AI output propertyKind is outside the approved enum." };
  }

  const bedrooms = positiveInt(raw.bedrooms, "bedrooms");
  if (!bedrooms.ok) return bedrooms;
  const bathrooms = positiveInt(raw.bathrooms, "bathrooms");
  if (!bathrooms.ok) return bathrooms;
  const corrections = stringArray(raw.corrections, "corrections");
  if (!corrections.ok) return corrections;
  const unsupportedReasons = stringArray(raw.unsupportedReasons, "unsupportedReasons");
  if (!unsupportedReasons.ok) return unsupportedReasons;
  const rawRiskFlags = stringArray(raw.riskFlags, "riskFlags");
  if (!rawRiskFlags.ok) return rawRiskFlags;
  if (rawRiskFlags.value.some((flag) => !riskFlags.has(flag as AiRiskFlag))) {
    return { ok: false, code: "AI_OUTPUT_INVALID", message: "AI output riskFlags contain an unsupported flag." };
  }

  return {
    ok: true,
    value: {
      serviceCode: raw.serviceCode as CleaningRequestExtraction["serviceCode"],
      bedrooms: bedrooms.value,
      bathrooms: bathrooms.value,
      hasOven: typeof raw.hasOven === "boolean" ? raw.hasOven : undefined,
      area: typeof raw.area === "string" ? raw.area : undefined,
      requestedDateText: typeof raw.requestedDateText === "string" ? raw.requestedDateText : undefined,
      requestedStartAt: typeof raw.requestedStartAt === "string" ? raw.requestedStartAt : undefined,
      customerName: typeof raw.customerName === "string" ? raw.customerName : undefined,
      propertyKind: raw.propertyKind as CleaningRequestExtraction["propertyKind"],
      corrections: corrections.value,
      unsupportedReasons: unsupportedReasons.value,
      riskFlags: rawRiskFlags.value as AiRiskFlag[],
    },
  };
}

function humanReview(reason: string): AssistantToolCall {
  return { name: "requestHumanReview", arguments: { reason }, allowed: true, reason };
}

export function guardAiToolCalls(rawCalls: unknown): AssistantToolCall[] {
  if (!safeDataArray(rawCalls,24)) return [humanReview("AI requested malformed tool call list.")];

  // Silently slicing 9+ model actions hides the overflow. Require a human
  // review for the complete attempt instead of dropping unknown extra work.
  if(rawCalls.length>8)return [humanReview("AI tool-call budget exceeded; entire proposal requires human review.")];
  return rawCalls.map((raw) => {
    if (!plainSafeObject(raw) ||
        Object.keys(raw).some(k=>k!=="name" && k!=="arguments") ||
        typeof raw.name !== "string" || !safeText(raw.name,64) ||
        (raw.arguments!==undefined &&
         (!plainSafeObject(raw.arguments) || !safeToolArguments(raw.arguments)))) {
      return humanReview("AI requested malformed tool call.");
    }

    const name = raw.name as string;
    if (blockedToolNames.has(name) || !allowedTools.has(name as AssistantToolCall["name"])) {
      return humanReview("AI requested blocked unsafe tool; untrusted tool name withheld.");
    }

    return {
      name: name as AssistantToolCall["name"],
      arguments: plainSafeObject(raw.arguments)
        ? raw.arguments : {},
      allowed: true,
      reason: "Allowed proposal only; execution must go through the ServiceDesk facade and policy checks.",
    };
  });
}
