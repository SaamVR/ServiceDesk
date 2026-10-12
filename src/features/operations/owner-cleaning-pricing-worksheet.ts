import {
  createQuoteSnapshot,
  type QuoteServiceCode,
} from "@/domain/quote";
import {
  parseOwnerCleaningPricingSetup,
} from "@/server/core/owner-cleaning-pricing-input";

/**
 * Non-persistent owner worksheet. It calls the SAME pure quote math used by
 * the product, but never talks to the quote API, database, Stripe, providers
 * or the AI runtime. Neither the scenario nor its quote is submitted.
 */
export type PricingWorksheetScenario = {
  service: QuoteServiceCode;
  bedrooms: number;
  bathrooms: number;
  oven: boolean;
};
export type OwnerPricingWorksheetResult =
  | { state: "INCOMPLETE"; detail: string }
  | { state: "READY"; value: {
      currency: "USD";
      service: QuoteServiceCode;
      subtotalMinor: number;
      depositMinor: number;
      balanceMinor: number;
      durationMinutes: number;
      bufferMinutes: number;
      approval: "BELOW_OWNER_THRESHOLD" | "REVIEW_THRESHOLD";
      lineItems: { description: string; amountMinor: number; durationMinutes: number }[];
      depositPercent: number;
      validHours: number;
    } };

export function evaluateOwnerPricingWorksheet(
  form: FormData,
  scenario: PricingWorksheetScenario,
): OwnerPricingWorksheetResult {
  if (!["STANDARD", "DEEP", "MOVE_OUT"].includes(scenario.service) ||
      !Number.isSafeInteger(scenario.bedrooms) || scenario.bedrooms < 0 ||
      scenario.bedrooms > 10 || !Number.isSafeInteger(scenario.bathrooms) ||
      scenario.bathrooms < 0 || scenario.bathrooms > 10 ||
      typeof scenario.oven !== "boolean") {
    return { state: "INCOMPLETE", detail: "Choose a valid service and between 0 and 10 bedrooms and bathrooms." };
  }
  const parsed = parseOwnerCleaningPricingSetup(form);
  if (!parsed.ok) {
    return {
      state: "INCOMPLETE",
      detail: "Complete all required business-owned prices, durations and policies to preview a quote. No default prices are supplied.",
    };
  }
  try {
    const value = parsed.value;
    const snapshot = createQuoteSnapshot({
      id: "11111111-1111-4111-8111-111111111111",
      workspaceId: "22222222-2222-4222-8222-222222222222",
      requestId: "33333333-3333-4333-8333-333333333333",
      serviceCode: scenario.service,
      bedrooms: scenario.bedrooms,
      bathrooms: scenario.bathrooms,
      oven: scenario.service === "MOVE_OUT" && scenario.oven,
      // This timestamp is only needed by the existing pure quote engine
      // to derive validity; it is never shown or submitted as a real event.
      now: "2030-01-01T00:00:00.000Z",
    }, {
      version: "unsaved-owner-pricing-worksheet",
      currency: value.currency,
      depositPercent: value.depositPercent,
      validHours: value.validHours,
      bufferMinutes: value.bufferMinutes,
      autoApprovalMaxTotalMinor: value.rules.autoApprovalMaxTotalMinor,
      standard: value.rules.standard,
      deep: value.rules.deep,
      moveOut: value.rules.moveOut,
    });
    return { state: "READY", value: {
      currency: "USD",
      service: scenario.service,
      subtotalMinor: snapshot.subtotalMinor,
      depositMinor: snapshot.depositMinor,
      balanceMinor: snapshot.balanceMinor,
      durationMinutes: snapshot.durationMinutes,
      bufferMinutes: snapshot.bufferMinutes,
      approval: snapshot.status === "APPROVED"
        ? "BELOW_OWNER_THRESHOLD" : "REVIEW_THRESHOLD",
      lineItems: snapshot.lineItems.map(item => ({
        description: item.description,
        amountMinor: item.amountMinor,
        durationMinutes: item.durationMinutes,
      })),
      depositPercent: value.depositPercent,
      validHours: value.validHours,
    } };
  } catch {
    return { state: "INCOMPLETE",
      detail: "The local worksheet could not calculate this scenario. Check the prices and counts before saving." };
  }
}
