import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseOwnerCleaningPricingSetup } from "../../src/server/core/owner-cleaning-pricing-input";
import { createQuoteSnapshot } from "../../src/domain/quote";
import {
  evaluateOwnerPricingWorksheet,
  type PricingWorksheetScenario,
} from "../../src/features/operations/owner-cleaning-pricing-worksheet";

function ownerEnteredForm(): FormData {
  const form = new FormData();
  const values: Record<string, string> = {
    setupId: "11111111-1111-4111-8111-111111111111",
    branchId: "22222222-2222-4222-8222-222222222222",
    currency: "USD",
    nameStandard: "Standard cleaning",
    nameDeep: "Deep cleaning",
    nameMoveOut: "Move-out cleaning",
    depositPercent: "25", validHours: "48", bufferMinutes: "30",
    autoApprovalMax: "550.50",
  };
  for (const prefix of ["standard", "deep", "moveOut"]) {
    Object.assign(values, {
      [prefix + "Base"]: "125.25",
      [prefix + "BaseMinutes"]: "90",
      [prefix + "Bedroom"]: "20.00",
      [prefix + "BedroomMinutes"]: "15",
      [prefix + "Bathroom"]: "15.50",
      [prefix + "BathroomMinutes"]: "10",
    });
  }
  values.moveOutOven = "35.50";
  values.moveOutOvenMinutes = "25";
  for (const [key, value] of Object.entries(values)) form.set(key, value);
  return form;
}
const caseFor = (
  service: PricingWorksheetScenario["service"],
  bedrooms = 0, bathrooms = 0, oven = false,
): PricingWorksheetScenario => ({ service, bedrooms, bathrooms, oven });

describe("owner-entered local quote worksheet uses product pricing math", () => {
  it("does not produce a fabricated preview until every required owner rate is entered", () => {
    const incomplete = ownerEnteredForm();
    incomplete.delete("deepBase");
    expect(evaluateOwnerPricingWorksheet(incomplete, caseFor("STANDARD")))
      .toMatchObject({ state: "INCOMPLETE" });
    const exponent = ownerEnteredForm();
    exponent.set("standardBase", "1e6");
    expect(evaluateOwnerPricingWorksheet(exponent, caseFor("STANDARD")))
      .toMatchObject({ state: "INCOMPLETE" });
    const wrongCurrency = ownerEnteredForm();
    wrongCurrency.set("currency", "GBP");
    expect(evaluateOwnerPricingWorksheet(wrongCurrency, caseFor("STANDARD")))
      .toMatchObject({ state: "INCOMPLETE" });
  });

  it("matches the real quote engine's exact minor-unit calculation and deposit rounding", () => {
    const form = ownerEnteredForm();
    const preview = evaluateOwnerPricingWorksheet(form, caseFor("STANDARD", 2, 3));
    expect(preview).toMatchObject({ state: "READY", value: {
      currency: "USD", subtotalMinor: 21175, depositMinor: 5294,
      balanceMinor: 15881, durationMinutes: 150, bufferMinutes: 30,
      approval: "BELOW_OWNER_THRESHOLD", depositPercent: 25, validHours: 48,
    } });
    if (preview.state !== "READY") throw new Error("Expected completed owner worksheet");
    const parsed = parseOwnerCleaningPricingSetup(form);
    if (!parsed.ok) throw new Error("Owner form unexpectedly invalid");
    const quote = createQuoteSnapshot({
      id: "11111111-1111-4111-8111-111111111111",
      workspaceId: "22222222-2222-4222-8222-222222222222",
      requestId: "33333333-3333-4333-8333-333333333333",
      serviceCode: "STANDARD", bedrooms: 2, bathrooms: 3,
      now: "2030-01-01T00:00:00.000Z",
    }, {
      version: "local-worksheet", currency: "USD",
      depositPercent: parsed.value.depositPercent,
      validHours: parsed.value.validHours,
      bufferMinutes: parsed.value.bufferMinutes,
      autoApprovalMaxTotalMinor: parsed.value.rules.autoApprovalMaxTotalMinor,
      standard: parsed.value.rules.standard, deep: parsed.value.rules.deep,
      moveOut: parsed.value.rules.moveOut,
    });
    expect(preview.value.subtotalMinor).toBe(quote.totalMinor);
    expect(preview.value.depositMinor).toBe(quote.depositMinor);
    expect(preview.value.lineItems).toEqual(quote.lineItems.map(line => ({
      description: line.description, amountMinor: line.amountMinor,
      durationMinutes: line.durationMinutes,
    })));
  });

  it("charges the oven only for MOVE_OUT and only with owner-selected add-on", () => {
    const form = ownerEnteredForm();
    const standard = evaluateOwnerPricingWorksheet(form, caseFor("STANDARD", 2, 3, true));
    const moveWithout = evaluateOwnerPricingWorksheet(form, caseFor("MOVE_OUT", 2, 3, false));
    const moveWith = evaluateOwnerPricingWorksheet(form, caseFor("MOVE_OUT", 2, 3, true));
    expect(standard).toMatchObject({ state: "READY", value: { subtotalMinor: 21175 } });
    expect(moveWithout).toMatchObject({ state: "READY", value: { subtotalMinor: 21175 } });
    expect(moveWith).toMatchObject({ state: "READY", value: {
      subtotalMinor: 24725, durationMinutes: 175,
    } });
    if (moveWith.state !== "READY" || standard.state !== "READY") throw Error("Unexpected incomplete test");
    expect(moveWith.value.lineItems.some(line => line.description === "Oven add-on")).toBe(true);
    expect(standard.value.lineItems.some(line => line.description === "Oven add-on")).toBe(false);
  });

  it("respects owner-entered approval threshold without making a real authorization decision", () => {
    const form = ownerEnteredForm();
    form.set("autoApprovalMax", "200.00");
    expect(evaluateOwnerPricingWorksheet(form, caseFor("DEEP", 2, 3)))
      .toMatchObject({ state: "READY", value: { approval: "REVIEW_THRESHOLD" } });
    form.set("autoApprovalMax", "211.75");
    expect(evaluateOwnerPricingWorksheet(form, caseFor("DEEP", 2, 3)))
      .toMatchObject({ state: "READY", value: { approval: "BELOW_OWNER_THRESHOLD" } });
  });

  it("rejects invalid room scenarios before domain evaluation", () => {
    const form = ownerEnteredForm();
    for (const counts of [caseFor("STANDARD", -1, 2), caseFor("DEEP", 11, 0),
      caseFor("MOVE_OUT", 1.5, 0), caseFor("STANDARD", 0, Number.NaN)]) {
      expect(evaluateOwnerPricingWorksheet(form, counts)).toMatchObject({ state: "INCOMPLETE" });
    }
  });

  it("keeps preview local and separate from protected persisted owner action", () => {
    const source = (name: string) => readFileSync(join(process.cwd(), name), "utf8");
    const client = source("src/features/operations/OwnerCleaningPricingWorksheet.tsx");
    const form = source("src/features/operations/OwnerCleaningPricingSetupForm.tsx");
    const pure = source("src/features/operations/owner-cleaning-pricing-worksheet.ts");
    expect(form).toContain("<OwnerCleaningPricingWorksheet />");
    expect(form).toContain('pendingLabel="Saving pricing…"');
    expect(client).toContain('"use client"');
    expect(client).toContain("new FormData(form)");
    expect(client).toContain("never");
    expect(client).not.toContain("fetch(");
    expect(client).not.toContain("supabase");
    expect(pure).toContain("createQuoteSnapshot");
    expect(pure).not.toContain("setupAuthorizedCleaningPricing");
    expect(pure).not.toContain("defaultRateCard");
  });
});
