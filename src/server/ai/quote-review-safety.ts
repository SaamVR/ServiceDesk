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
  return draft;
}
