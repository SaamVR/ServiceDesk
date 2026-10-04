import type { InvoiceDTO, QuoteDTO, RequestDTO, SlotDTO, VisitDTO } from "@/contracts";

interface PropertyRecurringInput {
  request: RequestDTO;
  quote: QuoteDTO;
  slot: SlotDTO;
  visit: VisitDTO;
  invoice: InvoiceDTO;
}

function money(minor: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(minor / 100);
}

export function buildPropertyRecurringView({ request, quote, slot, visit, invoice }: PropertyRecurringInput) {
  const propertyLabel = `${request.serviceCode === "MOVE_OUT" ? "Move-out clean" : request.serviceCode ?? "Service"} property · ${request.bedrooms ?? "?"} bed / ${request.bathrooms ?? "?"} bath`;
  const recurringEligible = visit.status === "COMPLETED" && invoice.status === "PAID";

  return {
    fixtureBoundary: "PROPERTY_AND_RECURRENCE_FIXTURE_ONLY" as const,
    propertyLabel,
    propertyMeta: [
      { label: "Property ID", value: request.propertyId ?? "Pending property record" },
      { label: "Customer ID", value: request.customerId ?? "Guest session" },
      { label: "Request version", value: `v${request.version}` },
    ],
    currentVisit: {
      startLabel: slot.startAt,
      crewLabel: slot.crewId,
      durationLabel: `${visit.serviceMinutes}m service + ${visit.bufferMinutes}m buffer`,
      quoteLabel: `${money(quote.totalMinor, quote.currency)} total · ${money(quote.depositMinor, quote.currency)} deposit`,
    },
    recurringCandidate: {
      frequencyLabel: "Monthly maintenance candidate",
      canAutoSchedule: recurringEligible,
      blocker: recurringEligible
        ? "Needs recurring service command and customer confirmation before scheduling."
        : "RecurringVisitDTO and customer approval command are not in the frozen contract yet.",
    },
    history: [
      { kind: "request" as const, label: "Request", value: request.status },
      { kind: "quote" as const, label: "Quote", value: `${quote.status} · v${quote.version}` },
      { kind: "visit" as const, label: "Visit", value: visit.status },
      { kind: "invoice" as const, label: "Invoice", value: `${invoice.status} · ${money(invoice.balanceMinor, invoice.currency)} balance` },
    ],
  };
}
