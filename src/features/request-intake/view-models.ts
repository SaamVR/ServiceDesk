import type { QuoteDTO, RequestDTO } from "@/contracts";

interface BuildEditableRequestSummaryInput {
  request: RequestDTO;
  quote: QuoteDTO;
}

function formatMinor(amount: number, currency: QuoteDTO["currency"]) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount / 100);
}

function formatPreferredTime(value?: string) {
  if (!value) return "Missing";
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(new Date(value));
}

export function buildEditableRequestSummary({ request, quote }: BuildEditableRequestSummaryInput) {
  const missingFields = [
    !request.serviceCode ? "service" : null,
    request.bedrooms === undefined ? "bedrooms" : null,
    request.bathrooms === undefined ? "bathrooms" : null,
    !request.requestedStartAt ? "preferred_time" : null,
  ].filter((field): field is string => Boolean(field));

  return {
    title: request.serviceCode === "MOVE_OUT" ? "Move-out clean request" : `${request.serviceCode ?? "Cleaning"} request`,
    statusLabel: request.status,
    versionLabel: `Request v${request.version} · Quote v${quote.version}`,
    totalLabel: `${formatMinor(quote.totalMinor, quote.currency)} total`,
    depositLabel: `${formatMinor(quote.depositMinor, quote.currency)} deposit`,
    durationLabel: `${quote.durationMinutes}m service + ${quote.bufferMinutes}m buffer`,
    missingFields,
    confirmationBlocked: missingFields.length > 0,
    primaryAction: missingFields.length > 0 ? "Complete missing details" : "Review quote and slot",
    editableFields: [
      { key: "service" as const, label: "Service", value: request.serviceCode ?? "Missing" },
      { key: "bedrooms" as const, label: "Bedrooms", value: request.bedrooms?.toString() ?? "Missing" },
      { key: "bathrooms" as const, label: "Bathrooms", value: request.bathrooms?.toString() ?? "Missing" },
      { key: "preferred_time" as const, label: "Preferred time", value: formatPreferredTime(request.requestedStartAt) },
    ],
    boundaryNotice: "Edits must call ServiceDeskFacade.updateRequest with CommandMeta; fixture fields do not mutate business truth.",
  };
}
