import { isCollectibleInvoice } from "./invoice-collection-queue";
import { isVerifiedStaffCollectibleInvoice, type StaffCollectibleLedger } from "./staff-invoice-collection-readiness";

export interface StartableVisit {
  id: string;
  startAt: string;
}

export function buildUpcomingVisits<T extends StartableVisit>(
  visits: readonly T[],
  loadedAt: string,
): T[] {
  const snapshotTime = Date.parse(loadedAt);

  return visits
    .filter((visit) => {
      const startTime = Date.parse(visit.startAt);
      return Number.isFinite(startTime)
        && (!Number.isFinite(snapshotTime) || startTime >= snapshotTime);
    })
    .sort((left, right) => {
      const timeDifference = Date.parse(left.startAt) - Date.parse(right.startAt);
      return timeDifference || left.id.localeCompare(right.id);
    });
}

export function formatWorkspaceDateTime(
  value: string | undefined,
  timeZone: string,
  locale = "en",
): string {
  if (!value) return "Not scheduled";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const format = (zone: string) =>
    new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: zone,
    }).format(date);

  try {
    return format(timeZone);
  } catch {
    return format("UTC");
  }
}

export interface InvoiceBalanceLike {
  status: string;
  currency: string;
  balanceMinor: number;
}

export interface OutstandingInvoiceSummary {
  count: number;
  currency?: string;
  totalMinor?: number;
  multipleCurrencies: boolean;
}

export function summarizeOutstandingInvoices(
  invoices: readonly InvoiceBalanceLike[],
): OutstandingInvoiceSummary {
  const openInvoices = invoices.filter(isCollectibleInvoice);
  const currencies = [...new Set(openInvoices.map((invoice) => invoice.currency))].sort();

  if (currencies.length !== 1) {
    return {
      count: openInvoices.length,
      multipleCurrencies: currencies.length > 1,
    };
  }

  return {
    count: openInvoices.length,
    currency: currencies[0],
    totalMinor: openInvoices.reduce((sum, invoice) => sum + invoice.balanceMinor, 0),
    multipleCurrencies: false,
  };
}

/** The Today KPI must never label a forged status/balance or a partial
 * refund allocation as collectible revenue. Keep such invoices in a
 * separate staff-review count without manufacturing an amount. */
export function summarizeVerifiedOutstandingInvoices(
  invoices: readonly StaffCollectibleLedger[],
): OutstandingInvoiceSummary & { needsLedgerReview: number } {
  const candidates=invoices.filter(item => isCollectibleInvoice({
    status:String(item.status), currency:String(item.currency), balanceMinor:Number(item.balanceMinor),
  }));
  const verified=candidates.filter(isVerifiedStaffCollectibleInvoice);
  const needsLedgerReview=candidates.length-verified.length;
  const currencies=[...new Set(verified.map(item=>item.currency as string))].sort();
  if(currencies.length!==1)return {
    count:verified.length,multipleCurrencies:currencies.length>1,needsLedgerReview,
  };
  const sum=verified.reduce((acc,item)=>acc+(item.balanceMinor as number),0);
  if(!Number.isSafeInteger(sum))return {
    count:verified.length,multipleCurrencies:false,needsLedgerReview:needsLedgerReview+verified.length,
  };
  return {count:verified.length,multipleCurrencies:false,
    currency:currencies[0],totalMinor:sum,needsLedgerReview};
}
