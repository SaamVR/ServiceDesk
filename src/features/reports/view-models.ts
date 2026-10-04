import type { InvoiceDTO, QuoteDTO, RequestDTO, VisitDTO } from "@/contracts";

interface ReportingInput {
  requests: RequestDTO[];
  quotes: QuoteDTO[];
  visits: VisitDTO[];
  invoices: InvoiceDTO[];
}

interface ReportCard {
  label: string;
  value: string;
  evidence: string;
}

export interface ReportingView {
  cards: ReportCard[];
  warning: string;
}

const money = (minor: number, currency = "USD") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(minor / 100);

const duration = (minutes: number) => {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `${hours}h${rest ? ` ${rest}m` : ""}`;
};

export function buildReportingView({ requests, quotes, visits, invoices }: ReportingInput): ReportingView {
  const suppliedRequestIds = new Set(requests.map((request) => request.id));
  const bookedRequestIds = new Set(
    requests
      .filter((request) => request.status === "BOOKED" || request.status === "CLOSED")
      .map((request) => request.id),
  );

  for (const visit of visits) {
    if (suppliedRequestIds.has(visit.requestId)) {
      bookedRequestIds.add(visit.requestId);
    }
  }

  const booked = bookedRequestIds.size;
  const totalRequests = requests.length;
  const conversion = totalRequests === 0 ? "No data" : `${Math.round((booked / totalRequests) * 100)}%`;

  const collectedMinor = invoices.reduce((sum, invoice) => sum + invoice.allocatedMinor - invoice.refundedMinor, 0);
  const balanceMinor = invoices.reduce((sum, invoice) => sum + invoice.balanceMinor, 0);
  const currency = invoices[0]?.currency ?? quotes[0]?.currency ?? "USD";

  const scheduledMinutes = visits.reduce((sum, visit) => sum + visit.serviceMinutes + visit.bufferMinutes, 0);
  const serviceMinutes = visits.reduce((sum, visit) => sum + visit.serviceMinutes, 0);
  const bufferMinutes = visits.reduce((sum, visit) => sum + visit.bufferMinutes, 0);

  return {
    warning: "Reports are derived from supplied stored records only; missing records are labelled instead of inferred.",
    cards: [
      {
        label: "Conversion",
        value: conversion,
        evidence: totalRequests === 0 ? "No request records supplied" : `${booked} booked / ${totalRequests} requests`,
      },
      {
        label: "Collected",
        value: invoices.length === 0 ? "No data" : money(collectedMinor, currency),
        evidence: invoices.length === 0 ? "No invoice records supplied" : `${money(balanceMinor, currency)} balance remains`,
      },
      {
        label: "Scheduled capacity",
        value: visits.length === 0 ? "No data" : duration(scheduledMinutes),
        evidence: visits.length === 0 ? "No visit records supplied" : `${serviceMinutes}m service + ${bufferMinutes}m buffer`,
      },
      {
        label: "Contribution",
        value: "Missing cost data",
        evidence: "Direct costs not supplied",
      },
    ],
  };
}
