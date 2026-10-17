import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  deliveryReviewLabel,
  parseInboxDeliveryDiagnostics,
} from "@/features/operations/inbox-delivery-diagnostics";

const valid = () => ({
  workspaceId: "ws-1",
  generatedAt: "2026-10-11T11:00:00.000Z",
  truncated: true,
  scannedOutboundMessages: 3,
  counts: { ok: 1, pending: 1, review: 1 },
  items: [
    { messageId: "msg-1", conversationId: "conv-1", channel: "WHATSAPP",
      deliveryState: "DELIVERED", health: "OK", ageMinutes: 23 },
    { messageId: "msg-2", conversationId: "conv-2", channel: "EMAIL",
      deliveryState: "QUEUED", health: "PENDING", ageMinutes: 12 },
    { messageId: "msg-3", conversationId: "conv-3", channel: "WHATSAPP",
      deliveryState: "PROVIDER_ACCEPTED", health: "NEEDS_REVIEW",
      reason: "STALE_PENDING", ageMinutes: 39 },
  ],
});

describe("read-only authorized delivery diagnostics", () => {
  it("accepts only bounded consistent counter metadata and never stores message bodies", () => {
    const result = parseInboxDeliveryDiagnostics(valid());
    expect(result?.counts).toEqual({ ok: 1, pending: 1, review: 1 });
    expect(result?.truncated).toBe(true);
    expect(result?.items.map(x => x.messageId)).toEqual(["msg-1", "msg-2", "msg-3"]);
    expect(result?.items[2].reason).toBe("STALE_PENDING");
    expect(result).not.toHaveProperty("workspaceId");
  });

  it("rejects malformed or unscoped responses rather than inventing success", () => {
    expect(parseInboxDeliveryDiagnostics(null)).toBeUndefined();
    expect(parseInboxDeliveryDiagnostics([])).toBeUndefined();
    expect(parseInboxDeliveryDiagnostics({ ...valid(), generatedAt: "invalid" })).toBeUndefined();
    expect(parseInboxDeliveryDiagnostics({ ...valid(), scannedOutboundMessages: 999 })).toBeUndefined();
    expect(parseInboxDeliveryDiagnostics({ ...valid(), counts: { ok: 3, pending: 0, review: 0 } })).toBeUndefined();
    expect(parseInboxDeliveryDiagnostics({ ...valid(), items: [
      valid().items[0],
      valid().items[1],
      { ...valid().items[2], conversationId: "../../other-workspace" },
    ] })).toBeUndefined();
    expect(parseInboxDeliveryDiagnostics({ ...valid(), items: [
      valid().items[0],
      valid().items[1],
      { ...valid().items[2], health: "CONFIRMED" },
    ] })).toBeUndefined();
    expect(parseInboxDeliveryDiagnostics({ ...valid(), items: [
      valid().items[0],
      valid().items[1],
      { ...valid().items[2], ageMinutes: -1 },
    ] })).toBeUndefined();
  });

  it("requires explicit zoned source time before presenting delivery health", () => {
    for (const generatedAt of [
      "2026-10-11", "2026-10-11T11:00:00",
      "2026-10-11 11:00:00", "2026-10-11T11:00:00+99:00",
      "2026-02-30T11:00:00Z", "2026-04-31T11:00:00Z",
      "2026-10-11T24:00:00Z", "2025-02-29T11:00:00Z",
    ]) {
      expect(parseInboxDeliveryDiagnostics({...valid(),generatedAt})).toBeUndefined();
    }
    for (const generatedAt of [
      "2026-10-11T11:00:00Z",
      "2026-10-11T14:00:00+03:00",
      "2026-10-11T11:00:00.000000Z",
      "2024-02-29T11:00:00Z",
    ]) {
      expect(parseInboxDeliveryDiagnostics({...valid(),generatedAt})?.counts)
        .toEqual({ok:1,pending:1,review:1});
    }
  });

  it("does not mark failed, suppressed or unknown delivery as healthy", () => {
    const first = valid().items[0];
    for (const altered of [
      { ...first, deliveryState: "FAILED" },
      { ...first, deliveryState: "SUPPRESSED" },
      { ...first, deliveryState: "UNKNOWN" },
      { ...first, deliveryState: "QUEUED" },
      { ...first, deliveryState: "PROVIDER_ACCEPTED" },
      { ...first, deliveryState: "READ", health: "NEEDS_REVIEW", reason: "STALE_PENDING" },
    ]) {
      expect(parseInboxDeliveryDiagnostics({ ...valid(), items: [altered, ...valid().items.slice(1)] }))
        .toBeUndefined();
    }
  });

  it("requires a state-consistent reason and a 30-minute pending threshold", () => {
    const base = valid().items[2];
    for (const altered of [
      { ...base, health: "OK" },
      { ...base, reason: "PROVIDER_FAILURE" },
      { ...base, ageMinutes: 29, health: "NEEDS_REVIEW" },
      { ...base, ageMinutes: 40, health: "PENDING" },
      { ...base, reason: undefined },
    ]) {
      expect(parseInboxDeliveryDiagnostics({ ...valid(), items: [valid().items[0], valid().items[1], altered] }))
        .toBeUndefined();
    }
    for (const accepted of [
      { ...base, deliveryState: "FAILED", reason: "PROVIDER_FAILURE" },
      { ...base, deliveryState: "SUPPRESSED", reason: "SUPPRESSED_BY_POLICY" },
      { ...base, deliveryState: "UNKNOWN", reason: "OUTBOX_RECEIPT_MISSING" },
      { ...base, deliveryState: "RUNNING", ageMinutes: 30, reason: "STALE_PENDING" },
    ]) {
      expect(parseInboxDeliveryDiagnostics({ ...valid(), items: [valid().items[0], valid().items[1], accepted] }))
        .toBeDefined();
    }
  });

  it("uses bounded operator-friendly review reason labels", () => {
    expect(deliveryReviewLabel("STALE_PENDING")).toBe("Pending longer than expected");
    expect(deliveryReviewLabel("OUTBOX_RECEIPT_MISSING")).toBe("Provider acceptance receipt missing");
    expect(deliveryReviewLabel()).toBe("Review provider evidence");
  });

  it("connects explicitly on demand and never fetches customer bodies or sends messages", () => {
    const ui = readFileSync(join(process.cwd(), "src/features/operations/InboxDeliveryDiagnostics.tsx"), "utf8");
    const route = readFileSync(join(process.cwd(), "src/features/operations/OperationalProductRoute.tsx"), "utf8");
    const css = readFileSync(join(process.cwd(), "src/features/operations/InboxDeliveryDiagnostics.module.css"), "utf8");
    expect(ui).toContain('fetch("/api/internal/inbox/delivery?"');
    expect(ui).toContain('credentials: "same-origin"');
    expect(ui).toContain('cache: "no-store"');
    expect(ui).toContain('method: "GET"');
    expect(ui).toContain("onClick={load}");
    expect(ui).toContain("No messages will be sent.");
    expect(ui).not.toContain("method: \"POST\"");
    expect(ui).not.toContain("retryDelivery");
    expect(route).toContain("<InboxDeliveryDiagnostics workspaceSlug={workspaceSlug} />");
    expect(css).toContain("min-height: 44px");
    expect(css).toContain(":focus-visible");
    expect(css).toContain("prefers-reduced-motion: reduce");
  });
});
