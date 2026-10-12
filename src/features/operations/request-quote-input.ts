export interface RequestQuoteInputs {
  requestId: string;
  expectedVersion: number;
  serviceCode: "STANDARD" | "DEEP" | "MOVE_OUT";
  bedrooms: number;
  bathrooms: number;
}
export type RequestQuoteInputResult =
  | { ok: true; value: RequestQuoteInputs }
  | { ok: false; message: string };

const uuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
function valueOf(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}
function integer(raw: string, min: number, max: number): number | null {
  if (!/^(0|[1-9][0-9]{0,6})$/.test(raw)) return null;
  const n = Number(raw);
  return Number.isSafeInteger(n) && n >= min && n <= max ? n : null;
}

/** Staff-entered structured facts, never inferred from an AI suggestion. */
export function parseRequestQuoteInputs(form: FormData): RequestQuoteInputResult {
  const requestId = valueOf(form, "requestId");
  const serviceCode = valueOf(form, "serviceCode");
  const expectedVersion = integer(valueOf(form, "expectedVersion"), 1, 2_147_483_647);
  const bedrooms = integer(valueOf(form, "bedrooms"), 0, 10);
  const bathrooms = integer(valueOf(form, "bathrooms"), 0, 10);
  if (!uuid(requestId) || !["STANDARD", "DEEP", "MOVE_OUT"].includes(serviceCode) ||
      expectedVersion === null || bedrooms === null || bathrooms === null) {
    return {
      ok: false,
      message: "Select a saved cleaning service and enter 0–10 bedrooms and bathrooms. Reload the request if its version changed.",
    };
  }
  return { ok: true, value: {
    requestId, serviceCode: serviceCode as RequestQuoteInputs["serviceCode"],
    bedrooms, bathrooms, expectedVersion,
  } };
}
