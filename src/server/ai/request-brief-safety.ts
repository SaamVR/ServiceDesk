/**
 * The model output is untrusted even if the request facts and prompt were safe.
 * Refuse to surface confident operational claims or contact/payment details
 * as a staff brief. This is a narrow, conservative filter — not authorization
 * to send messages, create prices, or execute actions.
 */
export function validateRequestBriefDraft(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const draft = value.trim();
  if (!draft || draft.length > 900 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(draft)) return undefined;
  // A request brief is intentionally generated without customer contact
  // details. A model that inserts any such data is hallucinating.
  if (/\bhttps?:\/\/\S+|www\.[a-z0-9-]+\.[a-z]{2,}|[\w.+-]+@[\w.-]+\.[a-z]{2,}\b/i.test(draft)) return undefined;
  // Model-proposed amounts and dates could be mistaken for authoritative
  // quotes or bookings. No amounts or date fields were sent in the context.
  if (/(?:[$€£]\s*\d|\b\d[\d,.]*\s*(?:USD|GBP|EUR|BDT)\b)/i.test(draft)) return undefined;
  if (/\b\d{4}-\d{2}-\d{2}\b|\b(?:0?[1-9]|1[0-2])\/\d{1,2}\/\d{2,4}\b/.test(draft)) return undefined;
  // A convincing US/international phone number should not appear from facts
  // consisting solely of a service code, room counts, and request status.
  if (/(?:\+\d{1,3}[-. ]?)?\(?\d{3}\)?[-. ]?\d{3}[-. ]?\d{4}\b/.test(draft)) return undefined;
  if (/<\/?(?:script|iframe|form|a|img|style|button)\b/i.test(draft)) return undefined;
  // Do not present a simulated state change as an already completed action.
  if (/\b(?:we|i|our team)\s+(?:have\s+)?(?:sent|charged|booked|scheduled|confirmed|approved|paid|invoiced)\b/i.test(draft)) return undefined;
  return draft;
}
