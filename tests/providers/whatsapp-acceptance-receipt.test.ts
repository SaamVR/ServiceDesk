import { describe, expect, test } from "vitest";
import type { OutboxJob, ProviderSendResult } from "../../src/server/integrations";
import {
  buildWhatsAppAcceptanceReceipt,
  mergeWhatsAppAcceptanceReceipt,
} from "../../src/server/integrations/whatsapp/acceptance-receipt";

function job(overrides: Partial<OutboxJob> = {}): OutboxJob {
  return {
    id: "job-wa-1",
    workspaceId: "ws-clearnest",
    channel: "WHATSAPP",
    purpose: "QUOTE",
    recipient: { recipientRef: "15551234567", consentRequired: true, hasOptIn: true, optedOut: false },
    createdAt: "2026-10-04T11:55:00.000Z",
    idempotencyKey: "outbox-wa-1",
    freeformText: "Your quote is ready.",
    payload: { lastInboundAt: "2026-10-04T11:30:00.000Z" },
    ...overrides,
  };
}

function providerResult(overrides: Partial<ProviderSendResult> = {}): ProviderSendResult {
  return {
    jobId: "job-wa-1",
    providerMessageId: "wamid.accepted.1",
    acceptedAt: "2026-10-04T12:00:00.000Z",
    mode: "SANDBOX",
    evidence: {
      provider: "WHATSAPP",
      mode: "SANDBOX",
      verification: "CONTRACT_TESTED",
      capturedAt: "2026-10-04T12:00:00.000Z",
      controlledId: "wamid.accepted.1",
      notes: ["Provider acceptance only."],
    },
    ...overrides,
  };
}

describe("WhatsApp provider acceptance receipt", () => {
  test("builds one logical acceptance receipt without delivery proof", () => {
    const receipt = buildWhatsAppAcceptanceReceipt({ job: job(), result: providerResult(), recordedAt: "2026-10-04T12:00:01.000Z" });

    expect(receipt).toMatchObject({
      receiptKey: "ws-clearnest:outbox-wa-1",
      workspaceId: "ws-clearnest",
      outboxJobId: "job-wa-1",
      providerMessageId: "wamid.accepted.1",
      deliverySemantics: "PROVIDER_ACCEPTANCE_ONLY",
      deliveryProof: false,
      readProof: false,
      recordedAt: "2026-10-04T12:00:01.000Z",
    });
    expect(JSON.stringify(receipt)).not.toContain("15551234567");
  });

  test("treats same receipt key as duplicate and preserves original provider message id", () => {
    const first = buildWhatsAppAcceptanceReceipt({ job: job(), result: providerResult(), recordedAt: "2026-10-04T12:00:01.000Z" });
    const retry = buildWhatsAppAcceptanceReceipt({
      job: job(),
      result: providerResult({ providerMessageId: "wamid.accepted.retry" }),
      recordedAt: "2026-10-04T12:01:00.000Z",
    });

    const merged = mergeWhatsAppAcceptanceReceipt(first, retry);

    expect(merged).toEqual({ status: "DUPLICATE", receipt: first });
  });

  test("rejects conflicting acceptance receipts for a different outbox idempotency key", () => {
    const first = buildWhatsAppAcceptanceReceipt({ job: job(), result: providerResult(), recordedAt: "2026-10-04T12:00:01.000Z" });
    const conflict = buildWhatsAppAcceptanceReceipt({
      job: job({ idempotencyKey: "outbox-wa-2" }),
      result: providerResult({ providerMessageId: "wamid.accepted.2" }),
      recordedAt: "2026-10-04T12:01:00.000Z",
    });

    const merged = mergeWhatsAppAcceptanceReceipt(first, conflict);

    expect(merged.status).toBe("CONFLICT");
  });
});
