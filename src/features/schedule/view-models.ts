import type { AttentionItemDTO, IntegrationStatusDTO, SlotDTO, VisitDTO } from "@/contracts";

export interface ScheduleLaneView {
  slotId: string;
  crewLabel: string;
  durationLabel: string;
  freshnessLabel: string;
  integrationLabel: string;
  conflictReasons: string[];
  canInstantConfirm: boolean;
}

export function buildScheduleLaneView(input: {
  slot: SlotDTO;
  visit?: VisitDTO;
  integrations: IntegrationStatusDTO[];
  attentionItems: AttentionItemDTO[];
}): ScheduleLaneView {
  const calendar = input.integrations.find((integration) => integration.provider === "GOOGLE_CALENDAR");
  const conflictReasons = input.attentionItems
    .filter((item) => item.resourceId === input.slot.id || item.type.includes("CALENDAR"))
    .map((item) => item.summary);
  const calendarHealthy = calendar?.status === "CONNECTED";
  const canInstantConfirm = input.slot.availabilityFresh && calendarHealthy && conflictReasons.length === 0;

  return {
    slotId: input.slot.id,
    crewLabel: input.slot.crewId,
    durationLabel: `${input.slot.serviceMinutes}m service + ${input.slot.bufferMinutes}m buffer`,
    freshnessLabel: input.slot.availabilityFresh ? "Fresh availability" : "Stale availability — staff review required",
    integrationLabel: calendar ? `Google Calendar · ${calendar.status} · ${calendar.mode ?? "mode pending"}` : "Google Calendar · NOT_CONFIGURED",
    conflictReasons,
    canInstantConfirm,
  };
}
