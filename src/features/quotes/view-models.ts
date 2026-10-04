import type { QuoteDTO, RequestDTO } from "@/contracts";

interface QuoteApprovalInput {
  request: RequestDTO;
  currentQuote: QuoteDTO;
  previousQuote?: QuoteDTO;
}

function money(minor: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(minor / 100);
}

function signedMoney(delta: number, currency: string) {
  if (delta === 0) return money(0, currency);
  const formatted = money(Math.abs(delta), currency);
  return `${delta > 0 ? "+" : "-"}${formatted}`;
}

function signedMinutes(delta: number) {
  if (delta === 0) return "0m";
  return `${delta > 0 ? "+" : ""}${delta}m`;
}

export function buildQuoteApprovalView({ request, currentQuote, previousQuote }: QuoteApprovalInput) {
  const hasPrevious = Boolean(previousQuote);
  const totalDelta = previousQuote ? currentQuote.totalMinor - previousQuote.totalMinor : 0;
  const depositDelta = previousQuote ? currentQuote.depositMinor - previousQuote.depositMinor : 0;
  const durationDelta = previousQuote ? currentQuote.durationMinutes - previousQuote.durationMinutes : 0;
  const needsApproval = currentQuote.status === "PENDING_APPROVAL" || currentQuote.totalMinor >= 30_000;

  return {
    requestLabel: `${request.serviceCode ?? "Service"} · ${request.id}`,
    versionLabel: hasPrevious
      ? `Quote v${currentQuote.version} compared with v${previousQuote?.version}`
      : `Quote v${currentQuote.version} has no previous fixture version`,
    stateLabel: currentQuote.status,
    current: {
      totalLabel: money(currentQuote.totalMinor, currentQuote.currency),
      depositLabel: money(currentQuote.depositMinor, currentQuote.currency),
      balanceLabel: money(currentQuote.balanceMinor, currentQuote.currency),
      durationLabel: `${currentQuote.durationMinutes}m + ${currentQuote.bufferMinutes}m buffer`,
      rateVersion: currentQuote.rateVersion,
      validUntil: currentQuote.validUntil,
    },
    delta: {
      totalDeltaLabel: hasPrevious ? signedMoney(totalDelta, currentQuote.currency) : "No comparison",
      depositDeltaLabel: hasPrevious ? signedMoney(depositDelta, currentQuote.currency) : "No comparison",
      durationDeltaLabel: hasPrevious ? signedMinutes(durationDelta) : "No comparison",
    },
    approval: {
      needsApproval,
      ownerLabel: needsApproval ? "Dispatcher approval required" : "Ready for staff send review",
      riskLabel: currentQuote.totalMinor >= 30_000 ? "High-value move-out clean" : "Standard quote",
    },
    canAiApprove: false,
    approvalBoundary: "AI can draft an explanation only. Staff approval and ServiceDeskFacade.sendQuote are required before customer send.",
  };
}
