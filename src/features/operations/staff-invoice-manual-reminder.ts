import { formatMinorMoney } from "./view-models";
import { isVerifiedStaffCollectibleInvoice } from "./staff-invoice-collection-readiness";

export interface StaffInvoiceReminderFacts {
  id: string;
  status: string;
  currency: string;
  quoteStatus?: string;
  quoteCurrency?: string;
  totalMinor: number;
  allocatedMinor: number;
  refundedMinor: number;
  balanceMinor: number;
}

/** This is a human-review clipboard draft, never a provider send.
 * No draft may be produced without a linked accepted saved quote and a
 * reconciled, payable refund-adjusted invoice.
 */
export function verifiedStaffInvoiceReminder(
  invoice: StaffInvoiceReminderFacts,
  currentOrigin: string,
): string | null {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(invoice.id) ||
      invoice.quoteStatus !== "ACCEPTED" || invoice.quoteCurrency !== invoice.currency ||
      !isVerifiedStaffCollectibleInvoice(invoice)) return null;
  let origin: URL;
  try {
    origin = new URL(currentOrigin);
    const local = origin.protocol === "http:" &&
      (origin.hostname === "localhost" || origin.hostname === "127.0.0.1");
    if ((origin.protocol !== "https:" && !local) || origin.origin !== currentOrigin ||
        origin.username || origin.password || origin.search || origin.hash ||
        origin.pathname !== "/") return null;
  } catch { return null; }
  const link = new URL("/portal/invoices/" + encodeURIComponent(invoice.id),origin).href;
  return [
    "Your cleaning service invoice is ready for review.",
    "Current saved outstanding balance: " + formatMinorMoney(invoice.balanceMinor, invoice.currency),
    "Recorded invoice total: " + formatMinorMoney(invoice.totalMinor, invoice.currency),
    "Recorded refunds: " + formatMinorMoney(invoice.refundedMinor, invoice.currency),
    "Review your exact saved invoice and any available payment options after signing in:",
    link,
    "This is a manually shared reminder, not a booking confirmation or payment receipt.",
  ].join("\n");
}
