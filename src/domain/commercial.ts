import type { CurrencyCode } from "../contracts/core";
import type { CommercialServicePlanFrequency } from "../contracts/commercial";
import { assertValidTimeZone, isIsoDate } from "./recurrence";

function assertClockTime(value: string, field: string): void {
  const match = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value);
  if (!match) throw new Error(`${field} must be an HH:mm or HH:mm:ss local time.`);
  const [, hh, mm, ss = "0"] = match;
  if (Number(hh) > 23 || Number(mm) > 59 || Number(ss) > 59) {
    throw new Error(`${field} is outside the valid clock range.`);
  }
}

export function assertCommercialEffectiveWindow(effectiveFrom: string, effectiveTo?: string): void {
  if (!isIsoDate(effectiveFrom)) throw new Error("Contract effectiveFrom must be an ISO calendar date.");
  if (effectiveTo !== undefined) {
    if (!isIsoDate(effectiveTo)) throw new Error("Contract effectiveTo must be an ISO calendar date.");
    if (effectiveTo < effectiveFrom) throw new Error("Contract effectiveTo cannot precede effectiveFrom.");
  }
}

export interface CommercialPortfolioRoles {
  authorizedRequester: boolean;
  billingContact: boolean;
  operationsContact: boolean;
}

export function assertCommercialPortfolioRoles(roles: CommercialPortfolioRoles): void {
  if (!roles.authorizedRequester && !roles.billingContact && !roles.operationsContact) {
    throw new Error("A portfolio contact must have at least one commercial role.");
  }
}

export interface CommercialAdjustmentRequest {
  kind?: "CREDIT" | "CHARGE";
  amountMinor?: number;
  currency?: CurrencyCode;
}

export function assertCommercialAdjustmentRequest(request: CommercialAdjustmentRequest): void {
  const values = [request.kind, request.amountMinor, request.currency];
  const present = values.filter((value) => value !== undefined).length;
  if (present === 0) return;
  if (present !== values.length) throw new Error("Adjustment kind, amount and currency must be supplied together.");
  if (!Number.isSafeInteger(request.amountMinor) || (request.amountMinor ?? 0) <= 0) {
    throw new Error("Adjustment amount must be a positive integer in minor currency units.");
  }
  if (!/^[A-Z]{3}$/.test(request.currency ?? "")) throw new Error("Adjustment currency must be a three-letter uppercase code.");
}

export interface CommercialServicePlanInput {
  frequency: CommercialServicePlanFrequency;
  timezone: string;
  localStartTime: string;
  startsOn: string;
  endsOn?: string;
  preferredWindowStart?: string;
  preferredWindowEnd?: string;
}

export function assertCommercialServicePlan(input: CommercialServicePlanInput): void {
  if (!["WEEKLY", "FORTNIGHTLY", "MONTHLY"].includes(input.frequency)) {
    throw new Error("Unsupported commercial service-plan frequency.");
  }
  assertValidTimeZone(input.timezone);
  assertClockTime(input.localStartTime, "localStartTime");
  assertCommercialEffectiveWindow(input.startsOn, input.endsOn);

  const hasWindowStart = input.preferredWindowStart !== undefined;
  const hasWindowEnd = input.preferredWindowEnd !== undefined;
  if (hasWindowStart !== hasWindowEnd) throw new Error("Preferred service window start and end must be supplied together.");
  if (hasWindowStart && hasWindowEnd) {
    assertClockTime(input.preferredWindowStart!, "preferredWindowStart");
    assertClockTime(input.preferredWindowEnd!, "preferredWindowEnd");
    if (input.preferredWindowEnd! <= input.preferredWindowStart!) {
      throw new Error("Preferred service window must end after it starts.");
    }
  }
}

export interface CommercialBillingPeriodInput {
  periodStart: string;
  periodEnd: string;
}

export function assertCommercialBillingPeriod(input: CommercialBillingPeriodInput): void {
  if (!isIsoDate(input.periodStart) || !isIsoDate(input.periodEnd)) {
    throw new Error("Commercial billing period must use ISO calendar dates.");
  }
  if (input.periodEnd < input.periodStart) {
    throw new Error("Commercial billing period end cannot precede its start.");
  }
}

export interface FixedPerVisitRate {
  billingModel: "FIXED_PER_VISIT";
  amountMinor: number;
}

export function resolveCommercialFixedPerVisitRate(
  contractRate: Record<string, unknown>,
  siteOverride?: Record<string, unknown>,
): FixedPerVisitRate {
  const candidate =
    siteOverride && siteOverride.billingModel !== undefined
      ? siteOverride
      : contractRate;
  if (candidate.billingModel !== "FIXED_PER_VISIT") {
    throw new Error("Commercial billing requires an explicit FIXED_PER_VISIT rate.");
  }
  if (!Number.isSafeInteger(candidate.amountMinor) || Number(candidate.amountMinor) <= 0) {
    throw new Error("Commercial fixed-per-visit amount must be a positive integer in minor currency units.");
  }
  return {
    billingModel: "FIXED_PER_VISIT",
    amountMinor: Number(candidate.amountMinor),
  };
}
