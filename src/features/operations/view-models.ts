import type {
  AttentionItemDTO,
  ConversationDTO,
  IntegrationStatusDTO,
  InvoiceDTO,
  QuoteDTO,
  RequestDTO,
  SlotDTO,
  VisitDTO,
} from "@/contracts";

export type SlotFreshness = "FRESH" | "STALE_REVIEW_REQUIRED";

export interface CustomerPortalView {
  requestId: string;
  serviceLabel: string;
  quoteVersionLabel: string;
  totalLabel: string;
  depositLabel: string;
  balanceLabel: string;
  slotFreshness: SlotFreshness;
  visitStatusLabel: string;
  handoverLabel: string;
}

export interface StaffQueueItemView {
  id: string;
  severity: AttentionItemDTO["severity"];
  summary: string;
  resourceLabel: string;
  integrationLabel?: string;
  nextAction: string;
}

export interface StaffQueueView {
  requestLabel: string;
  quoteLabel: string;
  channelLabel: string;
  handoverLabel: string;
  items: StaffQueueItemView[];
}

export interface CrewJobView {
  visitId: string;
  requestLabel: string;
  statusLabel: string;
  durationLabel: string;
  balanceLabel: string;
  nextAction: string;
}

export function formatMinorMoney(amountMinor: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amountMinor / 100);
}

export function buildCustomerPortalView(input: {
  request: RequestDTO;
  quote: QuoteDTO;
  slot: SlotDTO;
  visit: VisitDTO;
  invoice: InvoiceDTO;
  conversation: ConversationDTO;
}): CustomerPortalView {
  return {
    requestId: input.request.id,
    serviceLabel: serviceLabel(input.request),
    quoteVersionLabel: `Quote v${input.quote.version} · ${input.quote.status}`,
    totalLabel: formatMinorMoney(input.quote.totalMinor, input.quote.currency),
    depositLabel: formatMinorMoney(input.quote.depositMinor, input.quote.currency),
    balanceLabel: formatMinorMoney(input.invoice.balanceMinor, input.invoice.currency),
    slotFreshness: input.slot.availabilityFresh ? "FRESH" : "STALE_REVIEW_REQUIRED",
    visitStatusLabel: input.visit.status,
    handoverLabel: input.conversation.handoverActive ? "Human handover active" : "AI assistance available",
  };
}

export function buildStaffQueueView(input: {
  request: RequestDTO;
  quote?: QuoteDTO;
  conversation?: ConversationDTO;
  attentionItems: AttentionItemDTO[];
  integrations: IntegrationStatusDTO[];
}): StaffQueueView {
  return {
    requestLabel: `${input.request.id} · ${input.request.status}`,
    quoteLabel: input.quote ? `Quote v${input.quote.version} · ${input.quote.status}` : "No quote yet",
    channelLabel: input.conversation ? input.conversation.channel : "No conversation linked",
    handoverLabel: input.conversation?.handoverActive ? "Human handover active" : "No handover",
    items: input.attentionItems.map((item) => ({
      id: item.id,
      severity: item.severity,
      summary: item.summary,
      resourceLabel: `${item.resourceType} ${item.resourceId}`,
      integrationLabel: relatedIntegrationLabel(item, input.integrations),
      nextAction: nextActionForAttention(item),
    })),
  };
}

export function buildCrewJobView(input: {
  request: RequestDTO;
  visit: VisitDTO;
  invoice?: InvoiceDTO;
}): CrewJobView {
  const balanceLabel = input.invoice
    ? `Balance due ${formatMinorMoney(input.invoice.balanceMinor, input.invoice.currency)} after completion review`
    : "Balance invoice pending completion review";

  return {
    visitId: input.visit.id,
    requestLabel: serviceLabel(input.request),
    statusLabel: input.visit.status,
    durationLabel: `${input.visit.serviceMinutes}m service + ${input.visit.bufferMinutes}m buffer`,
    balanceLabel,
    nextAction: nextCrewAction(input.visit.status),
  };
}

function serviceLabel(request: RequestDTO) {
  const service = request.serviceCode ?? "Service not selected";
  const bedroomLabel = typeof request.bedrooms === "number" ? `${request.bedrooms} bed` : "bedrooms pending";
  const bathroomLabel = typeof request.bathrooms === "number" ? `${request.bathrooms} bath` : "bathrooms pending";

  return `${service} · ${bedroomLabel} · ${bathroomLabel}`;
}

function providerLabel(provider: IntegrationStatusDTO["provider"]) {
  switch (provider) {
    case "GOOGLE_CALENDAR":
      return "Google Calendar";
    case "WHATSAPP":
      return "WhatsApp";
    case "PAYMENT":
      return "Payment";
    case "EMAIL":
      return "Email";
    case "WEBHOOK":
      return "Webhook";
    case "AI":
      return "AI";
  }
}

function relatedIntegrationLabel(item: AttentionItemDTO, integrations: IntegrationStatusDTO[]) {
  const matched = integrations.find((integration) =>
    item.type.includes("CALENDAR") ? integration.provider === "GOOGLE_CALENDAR" : false,
  );

  if (!matched) {
    return undefined;
  }

  return `${providerLabel(matched.provider)} · ${matched.status} · ${matched.mode ?? "mode pending"}`;
}

function nextActionForAttention(item: AttentionItemDTO) {
  if (item.type.includes("CALENDAR")) {
    return "Review Calendar freshness before instant confirmation.";
  }

  if (item.type.includes("PAYMENT")) {
    return "Review payment state before confirming booking.";
  }

  if (item.type.includes("DELIVERY")) {
    return "Reconcile delivery before resending.";
  }

  return "Open the linked record and assign the next owner action.";
}

function nextCrewAction(status: VisitDTO["status"]) {
  switch (status) {
    case "CONFIRMED":
    case "ASSIGNED":
      return "Start travel";
    case "EN_ROUTE":
      return "Start job";
    case "IN_PROGRESS":
      return "Submit completion review";
    case "PENDING_REVIEW":
      return "Waiting for dispatcher review";
    case "COMPLETED":
      return "Job complete";
    case "AWAITING_PAYMENT":
      return "Awaiting payment confirmation";
    case "CANCELLED":
      return "Job cancelled";
    case "PAYMENT_REVIEW":
      return "Payment review required";
  }
}
