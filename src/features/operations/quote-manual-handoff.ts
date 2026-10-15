import { readVerifiedCustomerQuoteLineItems, type CustomerQuoteLineItem } from "./customer-quote-line-items";
import { formatMinorMoney } from "./view-models";

export interface ManualQuoteHandoffFacts {
  quoteId: string;
  status: string;
  currency: string;
  validUntil?: string;
  subtotalMinor?: number;
  taxMinor?: number;
  totalMinor: number;
  depositMinor: number;
  balanceMinor: number;
  durationMinutes: number;
  lineItems?: readonly CustomerQuoteLineItem[] | null;
}

/** Never compose an outbound-facing price message from missing or invented
 * staff data. This is a local clipboard draft, not a provider send/receipt.
 */
export function verifiedManualQuoteHandoffMessage(
  facts: ManualQuoteHandoffFacts, currentOrigin: string, now: Date = new Date(),
): string | null {
  if (facts.status !== "SENT" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(facts.quoteId) ||
      !/^[A-Z]{3}$/.test(facts.currency) ||
      !Array.isArray(facts.lineItems) ||
      typeof facts.subtotalMinor !== "number" || typeof facts.taxMinor !== "number" ||
      !Number.isSafeInteger(facts.depositMinor) || facts.depositMinor < 0 ||
      !Number.isSafeInteger(facts.balanceMinor) || facts.balanceMinor < 0 ||
      facts.depositMinor + facts.balanceMinor !== facts.totalMinor ||
      typeof facts.validUntil !== "string" || !Number.isFinite(Date.parse(facts.validUntil)) ||
      Date.parse(facts.validUntil) <= now.getTime()) return null;
  const lines = readVerifiedCustomerQuoteLineItems(
    { lineItems: facts.lineItems }, facts.subtotalMinor, facts.durationMinutes,
    facts.taxMinor, facts.totalMinor,
  );
  if (!lines) return null;
  // Saved service descriptions are data, not trusted outbound copy. Bidirectional
  // overrides/isolates and invisible zero-width controls can alter what a
  // customer sees after pasting prices into a messenger. Require staff review
  // of the original quote instead of silently removing those characters.
  const misleadingFormat = /[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/u;
  if (lines.some(item => misleadingFormat.test(item.description))) return null;
  let url: URL;
  try {
    const origin = new URL(currentOrigin);
    const local = origin.protocol === "http:" &&
      (origin.hostname === "localhost" || origin.hostname === "127.0.0.1");
    if ((origin.protocol !== "https:" && !local) ||
        origin.origin !== currentOrigin || origin.username || origin.password ||
        origin.search || origin.hash || origin.pathname !== "/") return null;
    url = new URL("/portal/quotes/" + encodeURIComponent(facts.quoteId), origin);
  } catch { return null; }
  try {
    const money=(minor: number) => formatMinorMoney(minor,facts.currency);
    return [
      "Your cleaning quote is ready for your review.",
      ...lines.map(item => item.description + " — " + money(item.amountMinor)),
      "Service subtotal: " + money(facts.subtotalMinor),
      "Tax: " + money(facts.taxMinor),
      "Quote total: " + money(facts.totalMinor),
      "Deposit: " + money(facts.depositMinor),
      "Remaining balance: " + money(facts.balanceMinor),
      "Valid until: " + new Date(facts.validUntil).toUTCString(),
      "View the saved quote securely (customer sign-in required): " + url.href,
      "This is a quote, not a payment receipt or booking confirmation.",
    ].join("\n");
  } catch { return null; }
}
