import type { Result } from "../../contracts";

/** USD-only first-run pricing until currency-specific minor-unit formats are supported. */
export interface OwnerCleaningPricingSetup {
  setupId: string;
  branchId: string;
  currency: "USD";
  serviceNames: { STANDARD: string; DEEP: string; MOVE_OUT: string };
  depositPercent: number;
  validHours: number;
  bufferMinutes: number;
  rules: {
    autoApprovalMaxTotalMinor: number;
    moveOut: PriceRuleInput;
    standard: PriceRuleInput;
    deep: PriceRuleInput;
  };
}
export interface PriceRuleInput {
  baseMinor: number;
  baseMinutes: number;
  bedroomMinor: number;
  bedroomMinutes: number;
  bathroomMinor: number;
  bathroomMinutes: number;
  ovenMinor?: number;
  ovenMinutes?: number;
}

function fail<T>(message: string): Result<T> {
  return { ok: false, code: "CLEANING_PRICING_INPUT_INVALID", message };
}
function str(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value.trim() : "";
}
function uuid(value: string): boolean {
  return /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value);
}
function whole(form: FormData, key: string, min: number, max: number): number | undefined {
  const raw = str(form, key);
  if (!/^(0|[1-9][0-9]{0,8})$/.test(raw)) return;
  const n = Number(raw);
  return Number.isSafeInteger(n) && n >= min && n <= max ? n : undefined;
}
function dollarsInMinorUnits(form: FormData, key: string, min = 0): number | undefined {
  const raw = str(form, key);
  // No exponent syntax, negative prices, locale rounding or hidden defaults.
  if (!/^(0|[1-9][0-9]{0,5})(\.[0-9]{1,2})?$/.test(raw)) return;
  const [d, cents = ""] = raw.split(".");
  const n = Number(d) * 100 + Number(cents.padEnd(2, "0"));
  return Number.isSafeInteger(n) && n >= min && n <= 10_000_000 ? n : undefined;
}
function serviceRule(form: FormData, prefix: string, withOven: boolean): PriceRuleInput | null {
  const baseMinor = dollarsInMinorUnits(form, prefix + "Base", 1);
  const baseMinutes = whole(form, prefix + "BaseMinutes", 1, 1440);
  const bedroomMinor = dollarsInMinorUnits(form, prefix + "Bedroom");
  const bedroomMinutes = whole(form, prefix + "BedroomMinutes", 0, 1440);
  const bathroomMinor = dollarsInMinorUnits(form, prefix + "Bathroom");
  const bathroomMinutes = whole(form, prefix + "BathroomMinutes", 0, 1440);
  if ([baseMinor, baseMinutes, bedroomMinor, bedroomMinutes, bathroomMinor, bathroomMinutes].some(v => v === undefined)) return null;
  const result: PriceRuleInput = {
    baseMinor: baseMinor!, baseMinutes: baseMinutes!,
    bedroomMinor: bedroomMinor!, bedroomMinutes: bedroomMinutes!,
    bathroomMinor: bathroomMinor!, bathroomMinutes: bathroomMinutes!,
  };
  if (withOven) {
    const ovenMinor = dollarsInMinorUnits(form, prefix + "Oven");
    const ovenMinutes = whole(form, prefix + "OvenMinutes", 0, 1440);
    if (ovenMinor === undefined || ovenMinutes === undefined) return null;
    result.ovenMinor = ovenMinor;
    result.ovenMinutes = ovenMinutes;
  }
  return result;
}
const PRICING_SETUP_FIELDS = [
  "setupId", "branchId", "currency", "nameStandard", "nameDeep", "nameMoveOut",
  "depositPercent", "validHours", "bufferMinutes", "autoApprovalMax",
  ...["standard","deep","moveOut"].flatMap(prefix => [
    prefix + "Base", prefix + "BaseMinutes", prefix + "Bedroom", prefix + "BedroomMinutes",
    prefix + "Bathroom", prefix + "BathroomMinutes",
  ]),
  "moveOutOven", "moveOutOvenMinutes",
];

export function parseOwnerCleaningPricingSetup(form: FormData): Result<OwnerCleaningPricingSetup> {
  // FormData.get() returns the first value. A duplicate field—even an
  // identical duplicate—is ambiguous customer pricing authority, not a
  // harmless formatting difference. Refuse it before constructing any rates.
  if (!form || typeof form.getAll !== "function" ||
      PRICING_SETUP_FIELDS.some(field => form.getAll(field).length !== 1)) {
    return fail("Pricing form is incomplete or contains conflicting values. Reload and try again.");
  }
  const setupId = str(form, "setupId");
  const branchId = str(form, "branchId");
  const currency = str(form, "currency");
  if (!uuid(setupId) || !uuid(branchId) || currency !== "USD") {
    return fail("Choose a valid authorized USD branch before setup.");
  }
  const names = {
    STANDARD: str(form, "nameStandard"),
    DEEP: str(form, "nameDeep"),
    MOVE_OUT: str(form, "nameMoveOut"),
  };
  if (Object.values(names).some(name => name.length < 3 || name.length > 120 || /[\x00-\x1f\x7f\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/u.test(name))) {
    return fail("Enter a valid cleaning service name for each service.");
  }
  const depositPercent = whole(form, "depositPercent", 0, 100);
  const validHours = whole(form, "validHours", 1, 720);
  const bufferMinutes = whole(form, "bufferMinutes", 0, 1440);
  const autoApprovalMaxTotalMinor = dollarsInMinorUnits(form, "autoApprovalMax");
  const standard = serviceRule(form, "standard", false);
  const deep = serviceRule(form, "deep", false);
  const moveOut = serviceRule(form, "moveOut", true);
  if ([depositPercent, validHours, bufferMinutes, autoApprovalMaxTotalMinor].some(v => v === undefined)
      || !standard || !deep || !moveOut) {
    return fail("Enter actual USD prices, durations, deposit and approval settings; no defaults are substituted.");
  }
  return { ok: true, value: {
    setupId, branchId, currency: "USD", serviceNames: names,
    depositPercent: depositPercent!, validHours: validHours!,
    bufferMinutes: bufferMinutes!, rules: {
      autoApprovalMaxTotalMinor: autoApprovalMaxTotalMinor!,
      standard, deep, moveOut,
    },
  } };
}
