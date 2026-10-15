import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { stableManualPaymentIdempotencyKey } from "../../src/features/operations/manual-payment-idempotency";

const payment = {
  workspaceId: "11111111-1111-4111-8111-111111111111",
  invoiceId: "22222222-2222-4222-8222-222222222222",
  amountMinor: 7500,
  currency: "USD",
  method: "BANK_TRANSFER" as const,
  reference: "Private bank payment ref 101",
};

describe("recorded offline payment safe retries", () => {
  test("identical retried submissions yield one stable deduplication identity", () => {
    const original = stableManualPaymentIdempotencyKey(payment);
    expect(stableManualPaymentIdempotencyKey({ ...payment })).toBe(original);
    expect(stableManualPaymentIdempotencyKey({ ...payment, reference: "  " + payment.reference + "  " })).toBe(original);
    expect(original).toMatch(/^manual-payment-v4:[a-f0-9]{64}$/);
    expect(original).not.toContain("bank");
    expect(original).not.toContain(payment.reference);
  });
  test("different real payment identities cannot alias", () => {
    const original = stableManualPaymentIdempotencyKey(payment);
    for (const different of [
      { invoiceId: "33333333-3333-4333-8333-333333333333" },
      { workspaceId: "44444444-4444-4444-8444-444444444444" },
      { amountMinor: 7600 },
      { currency: "EUR" },
      { method: "CASH" as const },
      { reference: "Private bank payment ref 102" },
    ]) {
      expect(stableManualPaymentIdempotencyKey({ ...payment, ...different })).not.toBe(original);
    }
  });
  test("server retains authenticated invoice checks but not fresh random keys per retry", () => {
    const code = readFileSync(join(process.cwd(), "src/features/operations/operational-product-runtime.ts"), "utf8");
    const start = code.indexOf("export async function applyOperationalManualPayment(");
    const end = code.indexOf("export async function ", start + 50);
    const action = code.slice(start, end);
    expect(action).toContain('requireOperationalBranchResource(resolved.value, "invoice", invoiceId)');
    expect(action).toContain('eq("workspace_id", resolved.value.workspace.id)');
    expect(action).toContain("isVerifiedStaffCollectibleInvoice({");
    expect(action).toContain("amountMinor > invoice.data.balance_minor");
    expect(action).toContain("idempotencyKey: stableManualPaymentIdempotencyKey({");
    expect(action).not.toContain("crypto.randomUUID()");
    const ui=readFileSync(join(process.cwd(), "src/features/operations/OperationalProductRoute.tsx"),"utf8");
    expect(ui).toContain("distinct bank or receipt reference for each new payment");
  });
});
