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
  const openInvoices = invoices.filter(
    (invoice) => invoice.balanceMinor > 0 && invoice.status !== "VOID",
  );
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
