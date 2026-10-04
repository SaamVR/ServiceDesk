import { describe, expect, test } from "vitest";
import { AuthoritativeWebhookDeliveryIntentResolver } from "../../src/server/integrations/webhook/authoritative-destination";
import { buildWebhookOperationalReceipt } from "../../src/server/integrations/webhook/operational-receipt";
import { buildOperationalProviderReadinessReport } from "../../src/server/integrations/provider-readiness";
import type { OutboxJob } from "../../src/server/integrations/types";

const job: OutboxJob = {
  id: "outbox-webhook-1",
  workspaceId: "ws-1",
  channel: "WEBHOOK",
  purpose: "STAFF_ALERT",
  recipient: { recipientRef: "webhook:endpoint-1", consentRequired: false, hasOptIn: true, optedOut: false },
  createdAt: "2026-10-04T17:30:00.000Z",
  idempotencyKey: "idem-webhook-1",
  payload: { url: "https://attacker.example/hook", signingSecret: "evil" },
};

describe("E08 authoritative webhook/n8n operational bridge", () => {
  test("resolves endpoint URL and signing configuration only from authoritative source", async () => {
    const resolver = new AuthoritativeWebhookDeliveryIntentResolver({
      async resolve() {
        return {
          ok: true,
          value: {
            endpointId: "endpoint-1",
            workflowId: "workflow-1",
            url: "https://hooks.example.com/servicedesk",
            allowedHost: "hooks.example.com",
            signingSecretRef: "secret-ref-1",
            signingSecret: "controlled-secret",
            body: { event: "test" },
          },
        };
      },
    });

    const resolved = await resolver.resolve(job);
    expect(resolved.ok).toBe(true);
    expect(resolved.ok && resolved.value.url).toBe("https://hooks.example.com/servicedesk");
    expect(JSON.stringify(resolved.ok && resolved.value)).not.toContain("controlled-secret");
    expect(JSON.stringify(resolved.ok && resolved.value)).not.toContain("evil");
  });

  test("rejects non-https or non-allowlisted destination", async () => {
    const resolver = new AuthoritativeWebhookDeliveryIntentResolver({
      async resolve() {
        return {
          ok: true,
          value: {
            endpointId: "endpoint-1",
            workflowId: "workflow-1",
            url: "http://hooks.example.com/servicedesk",
            allowedHost: "hooks.example.com",
            signingSecretRef: "secret-ref-1",
            signingSecret: "controlled-secret",
            body: {},
          },
        };
      },
    });

    const resolved = await resolver.resolve(job);
    expect(resolved.ok).toBe(false);
    expect(!resolved.ok && resolved.code).toBe("WEBHOOK_INVALID_DESTINATION");
  });

  test("classifies 2xx, 429, 5xx, final 4xx and n8n pending", () => {
    expect(buildWebhookOperationalReceipt({ receiptKey: "r1", endpointId: "e", providerMessageId: "m", status: 200, occurredAt: "2026-10-04T17:31:00.000Z" }).state).toBe("DELIVERED");
    expect(buildWebhookOperationalReceipt({ receiptKey: "r2", endpointId: "e", providerMessageId: "m", status: 429, occurredAt: "2026-10-04T17:31:00.000Z" }).action).toBe("E04_RETRY");
    expect(buildWebhookOperationalReceipt({ receiptKey: "r3", endpointId: "e", providerMessageId: "m", status: 503, occurredAt: "2026-10-04T17:31:00.000Z" }).action).toBe("E04_RETRY");
    expect(buildWebhookOperationalReceipt({ receiptKey: "r4", endpointId: "e", providerMessageId: "m", status: 404, occurredAt: "2026-10-04T17:31:00.000Z" }).action).toBe("ATTENTION_REVIEW");
    expect(buildWebhookOperationalReceipt({ receiptKey: "r5", endpointId: "e", providerMessageId: "m", status: 202, n8nState: "PENDING", occurredAt: "2026-10-04T17:31:00.000Z" }).state).toBe("N8N_PENDING");
  });

  test("readiness report lists exact missing provider configuration", () => {
    const report = buildOperationalProviderReadinessReport("2026-10-04T17:32:00.000Z");
    expect(report.liveProviderGate).toBe("MULTIPLE_REQUIRED");
    expect(report.email.requiredConfiguration.join(" ")).toContain("transactional email provider");
    expect(report.webhookN8n.requiredConfiguration.join(" ")).toContain("n8n workflow endpoint");
  });
});
