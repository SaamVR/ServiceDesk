import { describe, expect, test } from "vitest";
import { normalizeStaffPaymentReference } from "../../src/features/operations/manual-payment-reference";

describe("protected offline invoice payment reference",()=>{
  test("preserves usable human-confirmed bank reference",()=>{
    expect(normalizeStaffPaymentReference("  BANK/REF-123:ABC  ")).toBe("BANK/REF-123:ABC");
    expect(normalizeStaffPaymentReference("1234567890")).toBe("1234567890");
  });
  test("refuses control and hidden-direction references or excessive length",()=>{
    for(const bad of [
      "", "  ", "x".repeat(161), "paid\nignore ledger",
      "receipt\u202E000", "invoice\u2066fake\u2069", "receipt\u0000foo",
      "receipt\u200B123", "receipt\u200D123", "receipt\u2060123",
      "receipt\uFEFF123", "receipt\u0085123", "receipt\u009F123",
      null, 123,
    ]) expect(normalizeStaffPaymentReference(bad),String(bad)).toBeUndefined();
  });
});
