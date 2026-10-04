export type QuoteServiceCode = "MOVE_OUT" | "STANDARD" | "DEEP";
export type QuoteStatus = "DRAFT" | "PENDING_APPROVAL" | "APPROVED" | "SENT" | "ACCEPTED" | "DECLINED" | "EXPIRED" | "SUPERSEDED";

export interface ServiceRateRule {
  baseMinor: number;
  baseMinutes: number;
  bedroomMinor: number;
  bedroomMinutes: number;
  bathroomMinor: number;
  bathroomMinutes: number;
  ovenMinor?: number;
  ovenMinutes?: number;
}

export interface RateCard {
  version: string;
  currency: string;
  depositPercent: number;
  validHours: number;
  bufferMinutes: number;
  autoApprovalMaxTotalMinor: number;
  moveOut: ServiceRateRule;
  standard: ServiceRateRule;
  deep: ServiceRateRule;
}

export interface QuoteSnapshotInput {
  id: string;
  workspaceId: string;
  requestId: string;
  serviceCode: QuoteServiceCode;
  bedrooms: number;
  bathrooms: number;
  oven?: boolean;
  now: string;
}

export interface QuoteLineItem {
  code: string;
  description: string;
  amountMinor: number;
  durationMinutes: number;
}

export interface QuoteSnapshot {
  id: string;
  workspaceId: string;
  requestId: string;
  version: number;
  status: QuoteStatus;
  currency: string;
  serviceCode: QuoteServiceCode;
  subtotalMinor: number;
  taxMinor: number;
  totalMinor: number;
  depositMinor: number;
  balanceMinor: number;
  durationMinutes: number;
  bufferMinutes: number;
  rateVersion: string;
  validUntil: string;
  lineItems: QuoteLineItem[];
}

export const defaultRateCard: RateCard = {
  version: "synthetic-cleaning-v1",
  currency: "USD",
  depositPercent: 25,
  validHours: 48,
  bufferMinutes: 30,
  autoApprovalMaxTotalMinor: 50_000,
  moveOut: {
    baseMinor: 18_000,
    baseMinutes: 120,
    bedroomMinor: 3_000,
    bedroomMinutes: 20,
    bathroomMinor: 2_000,
    bathroomMinutes: 15,
    ovenMinor: 3_000,
    ovenMinutes: 30,
  },
  standard: {
    baseMinor: 10_000,
    baseMinutes: 75,
    bedroomMinor: 2_000,
    bedroomMinutes: 15,
    bathroomMinor: 1_500,
    bathroomMinutes: 10,
  },
  deep: {
    baseMinor: 15_000,
    baseMinutes: 120,
    bedroomMinor: 2_500,
    bedroomMinutes: 20,
    bathroomMinor: 2_000,
    bathroomMinutes: 15,
  },
};

function assertWholeInRange(name: string, value: number, min: number, max: number): void {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new RangeError(`${name} must be an integer between ${min} and ${max}`);
  }
}

function addHours(iso: string, hours: number): string {
  return new Date(new Date(iso).getTime() + hours * 60 * 60 * 1000).toISOString();
}

function ruleFor(serviceCode: QuoteServiceCode, rateCard: RateCard): ServiceRateRule {
  switch (serviceCode) {
    case "MOVE_OUT": return rateCard.moveOut;
    case "STANDARD": return rateCard.standard;
    case "DEEP": return rateCard.deep;
  }
}

function money(description: string, code: string, amountMinor: number, durationMinutes: number): QuoteLineItem {
  return { code, description, amountMinor, durationMinutes };
}

function depositMinor(totalMinor: number, percent: number): number {
  return Math.floor((totalMinor * percent + 50) / 100);
}

export function createQuoteSnapshot(input: QuoteSnapshotInput, rateCard: RateCard): QuoteSnapshot {
  assertWholeInRange("bedrooms", input.bedrooms, 0, 10);
  assertWholeInRange("bathrooms", input.bathrooms, 0, 10);

  const rule = ruleFor(input.serviceCode, rateCard);
  const lineItems: QuoteLineItem[] = [money("Base service", "BASE", rule.baseMinor, rule.baseMinutes)];

  if (input.bedrooms > 0) {
    lineItems.push(money(`${input.bedrooms} bedroom(s)`, "BEDROOM", input.bedrooms * rule.bedroomMinor, input.bedrooms * rule.bedroomMinutes));
  }

  if (input.bathrooms > 0) {
    lineItems.push(money(`${input.bathrooms} bathroom(s)`, "BATHROOM", input.bathrooms * rule.bathroomMinor, input.bathrooms * rule.bathroomMinutes));
  }

  if (input.serviceCode === "MOVE_OUT" && input.oven) {
    lineItems.push(money("Oven add-on", "OVEN", rule.ovenMinor ?? 0, rule.ovenMinutes ?? 0));
  }

  const subtotalMinor = lineItems.reduce((sum, item) => sum + item.amountMinor, 0);
  const durationMinutes = lineItems.reduce((sum, item) => sum + item.durationMinutes, 0);
  const taxMinor = 0;
  const totalMinor = subtotalMinor + taxMinor;
  const requiredDepositMinor = depositMinor(totalMinor, rateCard.depositPercent);

  return {
    id: input.id,
    workspaceId: input.workspaceId,
    requestId: input.requestId,
    version: 1,
    status: totalMinor <= rateCard.autoApprovalMaxTotalMinor ? "APPROVED" : "PENDING_APPROVAL",
    currency: rateCard.currency,
    serviceCode: input.serviceCode,
    subtotalMinor,
    taxMinor,
    totalMinor,
    depositMinor: requiredDepositMinor,
    balanceMinor: totalMinor - requiredDepositMinor,
    durationMinutes,
    bufferMinutes: rateCard.bufferMinutes,
    rateVersion: rateCard.version,
    validUntil: addHours(input.now, rateCard.validHours),
    lineItems,
  };
}
