import { describe, expect, it } from "vitest";
import { moveOutFixture } from "../../src/features/product/story-model";
import {
  sampleAttentionItems,
  sampleConversation,
  sampleIntegrations,
  sampleInvoice,
  sampleQuote,
  sampleRequest,
  sampleSlot,
  sampleVisit,
  showcaseIds,
} from "../../src/features/operations/sample-data";

describe("showcase sample data integrity", () => {
  it("keeps canonical showcase IDs centralized", () => {
    expect(showcaseIds).toMatchObject({
      workspace: "ws_showcase",
      request: "req_moveout_001",
      quote: "quote_moveout_001",
      slot: "slot_showcase_001",
      visit: "visit_showcase_001",
      invoice: "invoice_showcase_001",
      conversation: "conv_showcase_001",
    });
  });

  it("keeps linked sample records in one explicit workspace", () => {
    const workspaceIds = [
      sampleRequest.workspaceId,
      sampleQuote.workspaceId,
      sampleSlot.workspaceId,
      sampleVisit.workspaceId,
      sampleInvoice.workspaceId,
      sampleConversation.workspaceId,
      ...sampleAttentionItems.map((item) => item.workspaceId),
      ...sampleIntegrations.map((integration) => integration.workspaceId),
    ];

    expect(new Set(workspaceIds)).toEqual(new Set([showcaseIds.workspace]));
  });

  it("keeps sample request, quote, visit, invoice and conversation references consistent", () => {
    expect(sampleRequest.id).toBe(showcaseIds.request);
    expect(sampleQuote.id).toBe(showcaseIds.quote);
    expect(sampleSlot.id).toBe(showcaseIds.slot);
    expect(sampleVisit.id).toBe(showcaseIds.visit);
    expect(sampleInvoice.id).toBe(showcaseIds.invoice);
    expect(sampleConversation.id).toBe(showcaseIds.conversation);
    expect(sampleQuote.requestId).toBe(sampleRequest.id);
    expect(sampleVisit.requestId).toBe(sampleRequest.id);
    expect(sampleVisit.quoteId).toBe(sampleQuote.id);
    expect(sampleInvoice.visitId).toBe(sampleVisit.id);
    expect(sampleConversation.requestId).toBe(sampleRequest.id);
    expect(sampleConversation.customerId).toBe(sampleRequest.customerId);
  });

  it("preserves the frozen move-out pricing fixture", () => {
    expect(sampleQuote.totalMinor).toBe(34_000);
    expect(sampleQuote.depositMinor).toBe(8_500);
    expect(sampleQuote.balanceMinor).toBe(25_500);
    expect(sampleQuote.durationMinutes).toBe(240);
    expect(sampleQuote.bufferMinutes).toBe(30);
    expect(moveOutFixture.totalMinor).toBe(34_000);
    expect(moveOutFixture.depositMinor).toBe(8_500);
    expect(moveOutFixture.balanceMinor).toBe(25_500);
  });

  it("contains every V1 integration provider as non-live until provider evidence exists", () => {
    expect(sampleIntegrations.map((integration) => integration.provider)).toEqual([
      "WHATSAPP",
      "GOOGLE_CALENDAR",
      "PAYMENT",
      "EMAIL",
      "WEBHOOK",
      "AI",
    ]);

    expect(sampleIntegrations.every((integration) => integration.mode !== "LIVE")).toBe(true);
  });

  it("keeps attention items tied to known sample resources", () => {
    const knownResourceIds = new Set([
      sampleSlot.id,
      sampleConversation.id,
      sampleVisit.id,
      sampleInvoice.id,
    ]);

    expect(sampleAttentionItems.every((item) => knownResourceIds.has(item.resourceId))).toBe(true);
  });
});
