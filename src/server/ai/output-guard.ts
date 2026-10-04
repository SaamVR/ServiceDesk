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

function stringArray(value: unknown, field: string): Result<string[]> {
  if (value === undefined) return { ok: true, value: [] };
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    return { ok: false, code: "AI_OUTPUT_INVALID", message: `AI output field ${field} must be a string array.` };
  }
  return { ok: true, value };
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
  if (!value || typeof value !== "object" || Array.isArray(value)) {
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
  if (!Array.isArray(rawCalls)) return [humanReview("AI requested malformed tool call list.")];

  return rawCalls.slice(0, 8).map((raw) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw) || typeof (raw as { name?: unknown }).name !== "string") {
      return humanReview("AI requested malformed tool call.");
    }

    const name = (raw as { name: string }).name;
    if (blockedToolNames.has(name) || !allowedTools.has(name as AssistantToolCall["name"])) {
      return humanReview(`AI requested blocked unsafe tool: ${name}.`);
    }

    return {
      name: name as AssistantToolCall["name"],
      arguments: ((raw as { arguments?: unknown }).arguments && typeof (raw as { arguments?: unknown }).arguments === "object" && !Array.isArray((raw as { arguments?: unknown }).arguments))
        ? (raw as { arguments: Record<string, unknown> }).arguments
        : {},
      allowed: true,
      reason: "Allowed proposal only; execution must go through the ServiceDesk facade and policy checks.",
    };
  });
}
