import type { AiRiskFlag, CleaningRequestExtraction } from "./types";

const UNSUPPORTED_WORK = ["mold", "mould", "asbestos", "biohazard", "blood", "hazardous", "pest", "hoarding"];
const INJECTION_HINTS = ["ignore previous", "ignore the system", "developer message", "system prompt", "reveal prompt", "bypass"];
const SERVICE_ALIASES: Array<[CleaningRequestExtraction["serviceCode"], RegExp]> = [
  ["MOVE_OUT", /\b(move[ -]?out|end of tenancy|vacate|moving out)\b/i],
  ["DEEP", /\b(deep clean|deep cleaning)\b/i],
  ["STANDARD", /\b(standard|regular|weekly|fortnightly|basic)\b/i],
];

function intAfter(pattern: RegExp, text: string): number | undefined {
  const match = text.match(pattern);
  if (!match) return undefined;
  const value = Number.parseInt(match[1], 10);
  return Number.isFinite(value) ? value : undefined;
}

function serviceCode(text: string): CleaningRequestExtraction["serviceCode"] | undefined {
  return SERVICE_ALIASES.find(([, pattern]) => pattern.test(text))?.[0];
}

function propertyKind(text: string): CleaningRequestExtraction["propertyKind"] | undefined {
  if (/\bstudio\b/i.test(text)) return "STUDIO";
  if (/\bflat|apartment\b/i.test(text)) return "APARTMENT";
  if (/\bhouse|home\b/i.test(text)) return "HOUSE";
  if (/\boffice\b/i.test(text)) return "OFFICE";
  return undefined;
}

function requestedDateText(text: string): string | undefined {
  const iso = text.match(/\b\d{4}-\d{2}-\d{2}\b/);
  if (iso) return iso[0];
  const relative = text.match(/\b(today|tomorrow|next\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)|this\s+(?:weekend|friday|saturday|sunday))\b/i);
  if (relative) return relative[0];
  const datePhrase = text.match(/\b(?:mon|tue|wed|thu|fri|sat|sun)day\b[^.,;]*/i);
  return datePhrase?.[0]?.trim();
}

function serviceArea(text: string): string | undefined {
  const area = text.match(/\b(?:in|near|at)\s+([A-Z][A-Za-z ]{2,30}?)(?=\s+(?:today|tomorrow|next|this|on|with|for)|[.,;?]|$)/);
  return area?.[1]?.trim();
}

export function extractCleaningRequest(text: string): CleaningRequestExtraction {
  const lower = text.toLowerCase();
  const bedrooms = intAfter(/\b(\d{1,2})\s*(?:bed|bedroom|br)\b/i, text);
  const bathrooms = intAfter(/\b(\d{1,2})\s*(?:bath|bathroom|ba)\b/i, text);
  const corrections = Array.from(text.matchAll(/\b(?:actually|correction|change that|sorry)\b[^.!?]*/gi)).map((match) => match[0].trim());
  const unsupportedReasons = UNSUPPORTED_WORK.filter((word) => lower.includes(word));
  const riskFlags: AiRiskFlag[] = [];

  if (unsupportedReasons.length > 0) riskFlags.push("UNSUPPORTED_WORK");
  if (bedrooms !== undefined && bedrooms > 10) riskFlags.push("OVERSIZED_PROPERTY");
  if (bathrooms !== undefined && bathrooms > 10) riskFlags.push("OVERSIZED_PROPERTY");
  if (INJECTION_HINTS.some((hint) => lower.includes(hint))) riskFlags.push("PROMPT_INJECTION");
  if (/\b(customer|account|booking)\s+(?:for|of)\s+someone else\b/i.test(text)) riskFlags.push("CROSS_CUSTOMER_ACCESS");

  return {
    serviceCode: serviceCode(text),
    bedrooms,
    bathrooms,
    hasOven: /\boven\b/i.test(text) ? true : undefined,
    area: serviceArea(text),
    requestedDateText: requestedDateText(text),
    customerName: text.match(/\b(?:i am|i'm|name is)\s+([A-Z][A-Za-z'-]{1,30})\b/)?.[1],
    propertyKind: propertyKind(text),
    corrections,
    unsupportedReasons,
    riskFlags,
  };
}

export function missingIntakeQuestions(extraction: CleaningRequestExtraction): string[] {
  if (extraction.riskFlags.includes("UNSUPPORTED_WORK")) {
    return ["This looks like work that needs staff review. Can you confirm the condition and any safety risk?"].slice(0, 2);
  }

  const questions: string[] = [];
  if (!extraction.serviceCode) questions.push("Which service do you need: standard, deep clean or move-out clean?");
  if (extraction.bedrooms === undefined || extraction.bathrooms === undefined) questions.push("How many bedrooms and bathrooms should we quote for?");
  if (!extraction.area) questions.push("What area or postcode is the property in?");
  if (!extraction.requestedDateText) questions.push("What date or preferred time window works for you?");
  return questions.slice(0, 2);
}

export function shouldHandover(extraction: CleaningRequestExtraction, handoverActive?: boolean, providerFailure?: boolean): string | null {
  if (handoverActive) return "Human handover is active for this conversation.";
  if (providerFailure) return "AI provider failure; human follow-up required after preserving the customer message.";
  if (extraction.riskFlags.includes("PROMPT_INJECTION")) return "Prompt-injection text detected.";
  if (extraction.riskFlags.includes("CROSS_CUSTOMER_ACCESS")) return "Customer appears to request another customer's records.";
  if (extraction.riskFlags.includes("UNSUPPORTED_WORK")) return "Unsupported or hazardous work requires staff review.";
  if (extraction.riskFlags.includes("OVERSIZED_PROPERTY")) return "Property size is outside V1 automatic limits.";
  return null;
}
