import { createHash } from "node:crypto";

/** A retried staff submission must never become a second payment simply
 * because it reached a new server-action invocation. The same real-world
 * transfer/cash receipt uses the same reference on retries. An entirely new
 * payment MUST use a distinct reference.
 */
export function stableManualPaymentIdempotencyKey(args: {
  workspaceId: string;
  invoiceId: string;
  amountMinor: number;
  currency: string;
  method: "CASH" | "BANK_TRANSFER" | "OTHER";
  reference: string;
}): string {
  // Canonical tuple with length-delimited JSON encoding avoids concatenation
  // collisions. Hashing avoids publishing a customer's bank reference in the
  // payment record idempotency key or outbox deduplication value.
  const tuple = [
    "ServiceDeskManualPaymentV4",
    args.workspaceId,
    args.invoiceId,
    args.amountMinor,
    args.currency,
    args.method,
    args.reference.trim(),
  ];
  return "manual-payment-v4:" +
    createHash("sha256").update(JSON.stringify(tuple), "utf8").digest("hex");
}
