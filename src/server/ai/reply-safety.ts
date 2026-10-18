/** Generative customer-facing copy is never authorization to create commercial
 * commitments. This check intentionally errs toward human review rather than
 * emitting an invented price, confirmed slot or completed provider action. */
export type CustomerReplySafety =
  | {safe:true;text:string}
  | {safe:false;reason:"MISSING"|"UNBOUNDED"|"UNVERIFIED_CLAIM"};

export function reviewCustomerReplySafety(value:unknown):CustomerReplySafety {
  if(typeof value!=="string" || !value.trim())return {safe:false,reason:"MISSING"};
  const text=value.trim();
  if(text.length>1200 ||
     /[\u0000-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/u.test(text))
    return {safe:false,reason:"UNBOUNDED"};
  const risk=[
    /(?:[$€£]\s*\d|\b(?:USD|EUR|GBP|BDT)\s*\d|\b\d[\d,.]*\s*(?:USD|EUR|GBP|BDT)\b)/i,
    /\b(?:we|our team|i|i['’]ve|the team)\s+(?:have\s+|has\s+)?(?:charged|refunded|booked|scheduled|confirmed|paid|sent|issued|dispatched|approved)\b/i,
    /\b(?:your|the)\s+(?:booking|reservation|appointment|visit|quote|invoice|refund|payment|deposit|crew|cleaning team|job)\s+(?:is|was|has been|have been)\s+(?:confirmed|paid|received|processed|approved|sent|scheduled|completed|assigned|dispatched)\b/i,
    /\b(?:payment\s+received|refund\s+(?:processed|issued)|appointment\s+confirmed|reservation\s+confirmed|crew\s+(?:assigned|dispatched)|cleaning team\s+dispatched|quote\s+approved|invoice\s+paid)\b/i,
    // Third-person commercial completion claims are also unverified model
    // statements. They cannot be surfaced as delivered/paid/customer consent.
    /\b(?:the\s+)?(?:customer|client|guest)\s+(?:(?:has|have|had)\s+)?(?:paid|accepted|confirmed|received|approved)\b/i,
    /\b(?:the\s+)?(?:invoice|booking|quote|payment|refund|visit)\s+(?:(?:has|have)\s+been|was|were|is|are)\s+(?:paid|accepted|confirmed|processed|issued|approved|completed)\b/i,
    /\b(?:ignore\s+(?:all\s+)?previous\s+instructions|developer\s+mode|system\s+prompt)\b/i,
    /\b(?:https?:\/\/|www\.)\S+|[\w.+-]+@[\w.-]+\.[a-z]{2,}\b/i,
    /<\/?(?:script|iframe|form|img|style|a)\b/i,
  ];
  if(risk.some(pattern=>pattern.test(text)))return {safe:false,reason:"UNVERIFIED_CLAIM"};
  return {safe:true,text};
}
