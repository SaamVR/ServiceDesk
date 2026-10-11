import { describe, expect, it } from "vitest";
import { reconcileOutboundDelivery, type DeliveryOutboxEvidence } from "../../src/server/integrations/whatsapp/delivery-outbox-evidence";
import type { DeliveryState } from "../../src/server/integrations/whatsapp/delivery-triage";

const receipt: DeliveryOutboxEvidence = {
  id: "outbox-1", workspace_id: "ws-1", topic: "conversation.reply",
  status: "SENT", provider_reference: "provider-message-reference",
};
describe("durable outbox delivery reconciliation", () => {
  it("derives only provider acceptance from SENT with an actual provider reference", () => {
    expect(reconcileOutboundDelivery("QUEUED", receipt)).toEqual({
      deliveryState: "PROVIDER_ACCEPTED", evidenceSource: "OUTBOX_PROVIDER_ACCEPTANCE",
    });
    expect(reconcileOutboundDelivery("RUNNING", receipt)).toMatchObject({
      deliveryState: "PROVIDER_ACCEPTED",
    });
  });
  it("cannot invent delivered/read when only provider accepted the message", () => {
    for (const state of ["QUEUED", "RUNNING", "PROVIDER_ACCEPTED"] as DeliveryState[]) {
      const result = reconcileOutboundDelivery(state, receipt);
      expect(result.deliveryState).not.toMatch(/DELIVERED|READ/);
    }
  });
  it("preserves durable callback truth above any send-job snapshot", () => {
    for (const state of ["DELIVERED", "READ", "FAILED", "SUPPRESSED"] as DeliveryState[]) {
      expect(reconcileOutboundDelivery(state, { ...receipt, status: "FAILED" })).toEqual({
        deliveryState: state, evidenceSource: "MESSAGE_STATE",
      });
    }
  });
  it("surfaces terminal dispatch state for unchanged queued messages", () => {
    expect(reconcileOutboundDelivery("QUEUED", { ...receipt, status: "FAILED", provider_reference: null }))
      .toMatchObject({ deliveryState: "FAILED", evidenceSource: "OUTBOX_TERMINAL", reason: "OUTBOX_FAILED" });
    expect(reconcileOutboundDelivery("QUEUED", { ...receipt, status: "SUPPRESSED" }))
      .toMatchObject({ deliveryState: "SUPPRESSED", evidenceSource: "OUTBOX_TERMINAL", reason: "OUTBOX_SUPPRESSED" });
  });
  it("returns explicit unknown rather than false success for missing or incomplete provider records", () => {
    expect(reconcileOutboundDelivery("QUEUED", undefined))
      .toMatchObject({ deliveryState: "UNKNOWN", evidenceSource: "UNVERIFIED", reason: "OUTBOX_RECEIPT_MISSING" });
    expect(reconcileOutboundDelivery("QUEUED", { ...receipt, provider_reference: null }))
      .toMatchObject({ deliveryState: "UNKNOWN", evidenceSource: "UNVERIFIED", reason: "OUTBOX_REFERENCE_MISSING" });
    expect(reconcileOutboundDelivery("QUEUED", { ...receipt, status: "UNRECOGNIZED" }))
      .toMatchObject({ deliveryState: "UNKNOWN", evidenceSource: "UNVERIFIED" });
  });
  it("retains current queued state while the outbox remains pending", () => {
    expect(reconcileOutboundDelivery("QUEUED", { ...receipt, status: "PENDING", provider_reference: null }))
      .toEqual({ deliveryState: "QUEUED", evidenceSource: "MESSAGE_STATE" });
  });
});
