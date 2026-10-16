import { validateRequestBriefDraft } from "./request-brief-safety";

/** Quote-review model text is a staff suggestion, not a source of commercial,
 * booking or provider state. A general-purpose request brief validator blocks
 * contact data; these quote-specific checks additionally reject unsupported
 * money estimates, discounts and promises of future operational outcomes.
 */
export function validateStaffQuoteReviewDraft(value: unknown): string | undefined {
  const draft = validateRequestBriefDraft(value);
  if (!draft) return undefined;
  if (/\b(?:total|deposit|balance|subtotal|tax|discount|rate|cost|price|fee|amount|charge)\s*(?::|=|is\b|of\b)\s*\d/i.test(draft)) return undefined;
  // Numeric money may appear in natural model prose without symbols, or
  // with the ISO currency code before the amount. Neither was in the model
  // prompt: surfacing either would manufacture a merchant-approved price.
  if (/\b(?:USD|EUR|GBP|BDT)\s*\d[\d,.]*/i.test(draft)) return undefined;
  if (/\b\d[\d,.]*\s*(?:dollars?|euros?|pounds?|taka|tk)\b/i.test(draft)) return undefined;
  if (/\b(?:total|deposit|balance|subtotal|tax|discount|rate|cost|price|fee|amount|charge)\s*(?:(?:will|would|should|could)\s+be|equals?|of|around|about|estimated\s+at)\s*\d/i.test(draft)) return undefined;
  if (/\b(?:guarantee(?:d|s)?|promise(?:d|s)?|definitely|certainly)\b/i.test(draft)) return undefined;
  if (/\b(?:quote|payment|invoice|appointment|booking|deposit|availability|service\s+slot)\s+(?:is|was|has\s+been)\s+(?:approved|paid|processed|confirmed|sent|delivered|booked|scheduled|secured)\b/i.test(draft)) return undefined;
  if (/\b(?:customer\s+has\s+paid|we\s+(?:will|can)\s+(?:charge|refund|schedule|book|confirm|send)\b)/i.test(draft)) return undefined;
  // The model receives only service codes and durations. Statements about
  // customer approval, delivery receipts or settled payments cannot be
  // independently derived from those facts, even without a numeric amount.
  if (/\b(?:the\s+)?(?:customer|client)\s+(?:has\s+|already\s+)?(?:approved|accepted|confirmed|booked|paid|received)\b/i.test(draft)) return undefined;
  if (/\b(?:whats?app|e-?mail|message|notification)\s+(?:was|is|has\s+been)\s+(?:sent|delivered|received|confirmed)\b/i.test(draft)) return undefined;
  if (/\b(?:payment|deposit|balance|invoice|refund)\s+(?:was|is|has\s+been)\s+(?:paid|charged|settled|processed|refunded|received)\b/i.test(draft)) return undefined;
  // A staff-facing quality suggestion cannot certify a completed business
  // action just by changing the grammatical subject. "We already sent it"
  // or "our team approved" is as ungrounded as "the quote was sent".
  if (/\b(?:we|i|you|staff|our\s+team)\s+(?:(?:have|has|had)\s+)?(?:already\s+)?(?:sent|delivered|approved|accepted|booked|scheduled|charged|refunded|contacted|paid)\b/i.test(draft)) return undefined;
  if (/\b(?:the\s+|your\s+)?(?:quote|offer|invoice|message|job)\s+(?:was|is|has\s+been)\s+(?:sent|delivered|approved|accepted|processed|confirmed|scheduled|booked|settled)\b/i.test(draft)) return undefined;
  // Invisible bidi controls can reverse quoted evidence/charges or spoof the
  // order of fields while still passing ordinary printable-text checks.
  if (/[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/u.test(draft)) return undefined;
  return draft;
}

/** The model only received persisted codes, never the customer's request.
 * Reject a checklist that presumes a chargeable area/add-on absent from the
 * saved quote. This is deliberately narrower than broad semantic grounding:
 * it makes no claim to validate other natural-language instructions.
 */
export function validateStaffQuoteReviewGrounding(
  review: unknown,
  savedLineCodes: readonly string[],
): string | undefined {
  const text = validateStaffQuoteReviewDraft(review);
  if (!text || !Array.isArray(savedLineCodes) ||
      savedLineCodes.length < 1 || savedLineCodes.length > 25 ||
      savedLineCodes.some(code => typeof code !== "string" ||
        !/^[A-Z][A-Z0-9_]{1,31}$/.test(code))) return undefined;
  const saved = new Set(savedLineCodes);
  const namedItems: ReadonlyArray<[RegExp, string]> = [
    [/\bovens?\b/i, "OVEN"],
    [/\bbedrooms?\b/i, "BEDROOM"],
    [/\b(?:bathrooms?|restrooms?)\b/i, "BATHROOM"],
  ];
  for (const [pattern, code] of namedItems) {
    if (pattern.test(text) && !saved.has(code)) return undefined;
  }
  return text;
}
