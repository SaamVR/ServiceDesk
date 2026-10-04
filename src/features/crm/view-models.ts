import type { ConversationDTO, InvoiceDTO, QuoteDTO, RequestDTO, VisitDTO } from "@/contracts";

interface BuildCrmCustomerViewInput {
  request: RequestDTO;
  quote: QuoteDTO;
  visit: VisitDTO;
  invoice: InvoiceDTO;
  conversation: ConversationDTO;
}

function formatMinor(amount: number, currency: InvoiceDTO["currency"]) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount / 100);
}

function formatDateTime(value?: string) {
  if (!value) return "No timestamp";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(new Date(value));
}

export function buildCrmCustomerView({ request, quote, visit, invoice, conversation }: BuildCrmCustomerViewInput) {
  return {
    source: "DTO_SAMPLE" as const,
    customerLabel: `Customer ${request.customerId ?? conversation.customerId ?? "unknown"}`,
    propertyLabel: `Property ${request.propertyId ?? "not captured"}`,
    requestSummary: `${request.serviceCode ?? "SERVICE"} · ${request.status} · ${request.bedrooms ?? "?"} bed / ${request.bathrooms ?? "?"} bath`,
    quoteSummary: `Quote v${quote.version} · ${quote.status} · ${formatMinor(quote.totalMinor, quote.currency)}`,
    visitSummary: `Visit ${visit.status} · ${formatDateTime(visit.startAt)} · ${visit.serviceMinutes + visit.bufferMinutes}m reserved`,
    financialSummary: `${formatMinor(invoice.allocatedMinor, invoice.currency)} collected · ${formatMinor(invoice.balanceMinor, invoice.currency)} balance`,
    lastContactLabel: `${conversation.channel} · ${conversation.handoverActive ? "handover active" : "AI draft mode"} · ${formatDateTime(conversation.lastMessageAt)}`,
    nextActions: [
      request.status === "QUOTED" ? "Review calendar freshness before confirming slot" : "Review request state",
      quote.status === "SENT" ? "Wait for customer acceptance or resend quote" : "Review quote status",
      invoice.balanceMinor > 0 ? "Track balance after completion review" : "No balance follow-up needed",
    ],
    boundaryNotice: "CRM panels must be replaced by the facade snapshot before production use; fixture DTOs do not create customer records.",
  };
}
