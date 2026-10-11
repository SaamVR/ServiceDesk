import { describe, expect, it } from "vitest";
import { handleDeliveryTriageHttpGet } from "../../src/server/api-handlers/delivery-triage-http";
import type { DeliveryTriageSnapshot } from "../../src/server/integrations/whatsapp/delivery-triage";

const snapshot: DeliveryTriageSnapshot = {
  workspaceId: "ws1", generatedAt: "2026-10-11T06:00:00.000Z", truncated: false,
  scannedOutboundMessages: 1, counts: { ok: 0, pending: 0, review: 1 },
  items: [{ messageId: "message1", conversationId: "conversation1", channel: "WHATSAPP",
    deliveryState: "FAILED", createdAt: "2026-10-11T05:00:00Z",
    ageMinutes: 60, health: "NEEDS_REVIEW", reason: "PROVIDER_FAILURE" }],
};
const url = "https://desk.example.test/api/internal/inbox/delivery?workspaceSlug=service-desk";
describe("read-only delivery triage HTTP", () => {
  it("resolves a single server-authorized workspace and never caches or adds PII", async () => {
    const seen: string[] = [];
    const response = await handleDeliveryTriageHttpGet(new Request(url), async slug => {
      seen.push(slug);
      return { ok: true, value: snapshot };
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("vary")).toBe("Cookie");
    expect(await response.json()).toEqual(snapshot);
    expect(seen).toEqual(["service-desk"]);
  });

  it("refuses unexpected params and malformed tenant scopes before accessing data", async () => {
    let called = 0;
    for (const malformed of [
      "https://desk.example.test/api/internal/inbox/delivery",
      "https://desk.example.test/api/internal/inbox/delivery?workspaceSlug=../foreign",
      url + "&role=OWNER",
      url + "&workspaceSlug=foreign",
    ]) {
      const response = await handleDeliveryTriageHttpGet(new Request(malformed), async () => {
        called++;
        return { ok: true, value: snapshot };
      });
      expect(response.status).toBe(400);
    }
    expect(called).toBe(0);
  });

  it("rejects cross-site requests without reading the tenant snapshot", async () => {
    let called = 0;
    const invalidHeaders: Array<Record<string, string>> = [
      { "sec-fetch-site": "cross-site" },
      { origin: "https://other.example.test" },
    ];
    for (const headers of invalidHeaders) {
      const response = await handleDeliveryTriageHttpGet(new Request(url, { headers }), async () => {
        called++;
        return { ok: true, value: snapshot };
      });
      expect(response.status).toBe(403);
    }
    expect(called).toBe(0);
  });

  it("uses minimal stable codes for unauthorized and missing branch scope", async () => {
    for (const [code, status] of [
      ["DELIVERY_TRIAGE_UNAUTHORIZED", 401],
      ["DELIVERY_TRIAGE_BRANCH_UNAVAILABLE", 403],
      ["DELIVERY_TRIAGE_READ_FAILED", 503],
    ] as const) {
      const response = await handleDeliveryTriageHttpGet(new Request(url), async () => ({
        ok: false, code, message: "secret customer phone and database trace",
      }));
      expect(response.status).toBe(status);
      expect(await response.json()).toEqual({ code });
    }
  });

  it("does not reflect thrown provider/database exceptions", async () => {
    const response = await handleDeliveryTriageHttpGet(new Request(url), async () => {
      throw new Error("database token secret");
    });
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ code: "DELIVERY_TRIAGE_UNAVAILABLE" });
  });
});
