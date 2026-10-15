import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { stableManualPaymentIdempotencyKey } from "../../src/features/operations/manual-payment-idempotency";
import { verifiedManualPaymentReplay } from "../../src/features/operations/manual-payment-replay-proof";

const args = {
  workspaceId: "11111111-1111-4111-8111-111111111111",
  invoiceId: "22222222-2222-4222-8222-222222222222",
  amountMinor: 7500,
  currency: "USD",
  method: "BANK_TRANSFER" as const,
  reference: "Deposit TXN 000101",
};
const key = stableManualPaymentIdempotencyKey(args);
const invoice = {
  status: "PAID", currency: "USD", total_minor: 7500,
  allocated_minor: 7500, refunded_minor: 0, balance_minor: 0,
};
const saved = {
  id: "33333333-3333-4333-8333-333333333333",
  ledger_entry_id: "44444444-4444-4444-8444-444444444444",
  workspace_id: args.workspaceId, invoice_id: args.invoiceId,
  amount_minor: args.amountMinor, currency: args.currency,
  method: args.method, reference: args.reference, idempotency_key: key,
};

describe("manual payment after-commit retry", () => {
  test("only a matching ledger-backed receipt can confirm an already paid invoice", () => {
    expect(verifiedManualPaymentReplay(invoice, saved, { ...args, idempotencyKey: key })).toBe(true);
    expect(verifiedManualPaymentReplay(invoice, null, { ...args, idempotencyKey: key })).toBe(false);
  });

  test("never claims success for foreign payment, changed amount, or inconsistent paid flags", () => {
    for (const patch of [
      { invoice_id: "55555555-5555-4555-8555-555555555555" },
      { workspace_id: "66666666-6666-4666-8666-666666666666" },
      { ledger_entry_id: "not-uuid" },
      { amount_minor: 9000 }, { currency: "EUR" },
      { reference: "different" }, { method: "CASH" },
      { idempotency_key: "manual-payment-v4:forged" },
    ]) {
      expect(verifiedManualPaymentReplay(invoice, { ...saved, ...patch },
        { ...args, idempotencyKey: key })).toBe(false);
    }
    for (const patch of [
      { status: "VOID" }, { balance_minor: 1000 },
      { total_minor: 7600 }, { allocated_minor: 7600 },
      { refunded_minor: 1 }, { allocated_minor: Number.NaN },
    ]) {
      expect(verifiedManualPaymentReplay({ ...invoice, ...patch }, saved,
        { ...args, idempotencyKey: key })).toBe(false);
    }
  });

  test("queries only the exact authorized workspace/invoice/idempotency receipt after PAID", () => {
    const s = readFileSync(join(process.cwd(),
      "src/features/operations/operational-product-runtime.ts"),"utf8");
    const start = s.indexOf("export async function applyOperationalManualPayment(");
    const end = s.indexOf("export async function ",start+55);
    const action=s.slice(start,end);
    expect(action).toContain('requireOperationalBranchResource(resolved.value, "invoice", invoiceId)');
    expect(action).toContain('if (invoice.data.status === "PAID")');
    expect(action).toContain('from("manual_payment_records")');
    expect(action).toContain('eq("workspace_id", resolved.value.workspace.id)');
    expect(action).toContain('eq("invoice_id", invoiceId)');
    expect(action).toContain('eq("idempotency_key", key)');
    expect(action).toContain('verifiedManualPaymentReplay(invoice.data, saved.data ?? null');
    expect(action).toContain("No duplicate payment was created.");
    expect(action.indexOf('from("manual_payment_records")')).toBeLessThan(
      action.indexOf("isVerifiedStaffCollectibleInvoice({"));
    expect(action.indexOf("isVerifiedStaffCollectibleInvoice({")).toBeLessThan(
      action.indexOf("facade.applyManualPayment("));
  });
});
