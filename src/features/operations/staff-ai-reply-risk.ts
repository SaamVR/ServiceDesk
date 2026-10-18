/** Heuristic operator review categories for AI-generated or edited replies.
 * This function never authorizes transmission, diagnoses legal/commercial
 * compliance, persists customer data or extracts the suspected sensitive text.
 * A false negative is possible: explicit staff review remains mandatory.
 */
export type StaffReplyRisk =
  | "EXTERNAL_LINK"
  | "CONTACT_INSTRUCTION"
  | "PAYMENT_CLAIM"
  | "BOOKING_COMMITMENT";
export const staffReplyRiskLabels:Readonly<Record<StaffReplyRisk,string>>={
  EXTERNAL_LINK:"External link or redirect",
  CONTACT_INSTRUCTION:"Contact address or telephone instruction",
  PAYMENT_CLAIM:"Payment, price, refund or deposit statement",
  BOOKING_COMMITMENT:"Booking or service-completion promise",
};
export function detectStaffReplyRisks(text:unknown):StaffReplyRisk[]{
  if(typeof text!=="string" || !text.trim())return [];
  const risks:StaffReplyRisk[]=[];
  if(/(?:https?:\/\/|www\.|mailto:|tel:)/iu.test(text))
    risks.push("EXTERNAL_LINK");
  if(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/iu.test(text) ||
     /(?:\+?\d[\d\s().-]{8,}\d)/u.test(text) ||
     /\b(?:call|text|whatsapp|email)\s+(?:me|us|our|this|my)\b/iu.test(text))
    risks.push("CONTACT_INSTRUCTION");
  if(/[$€£₹৳]/u.test(text) ||
     /\b(?:pay(?:ment)?|deposit|refund|invoice|credit card|bank transfer|charge(?:d)?|price|total cost)\b/iu.test(text))
    risks.push("PAYMENT_CLAIM");
  if(/\b(?:booked|booking confirmed|appointment confirmed|we guarantee|guaranteed completion|service completed|fully scheduled)\b/iu.test(text))
    risks.push("BOOKING_COMMITMENT");
  return risks;
}
