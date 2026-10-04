import { describe, expect, test } from "vitest";
import type { ActorContext, CommandMeta } from "../../src/contracts";
import type { OutboxJob, ProviderSendResult } from "../../src/server/integrations";
import type { WhatsAppCloudHttpTransport } from "../../src/server/integrations/whatsapp/cloud-api";
import {
  dispatchWhatsAppOutboxJob,
  type WhatsAppOutboundDispatchStore,
} from "../../src/server/integrations/whatsapp/outbound-dispatcher";

const ctx: ActorContext = { workspaceId: "ws-clearnest", role: "OWNER", userId: "owner-1" };
const meta: CommandMeta = { idempotencyKey: "cmd-dispatch-1", now: "2026-10-04T12:00:00.000Z" };

const config = {
  graphBaseUrl: "https://graph.facebook.com",
  apiVersion: "v23.0",
  phoneNumberId: "123456789",
  accessToken: "super-secret-token",
  timeoutMs: 1000,
  templateLanguageCode: "en_US",
  mode: "SANDBOX" as const,
  now: () => "2026-10-04T12:00:00.000Z",
};

function queuedJob(overrides: Partial<OutboxJob> = {}): OutboxJob {
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

function acceptingTransport(calls: Array<Parameters<WhatsAppCloudHttpTransport>[0]>): WhatsAppCloudHttpTransport {
  return async (request) => {
    calls.push(request);
    return { status: 200, body: JSON.stringify({ messages: [{ id: "wamid.accepted.dispatch" }] }) };
  };
}

function store(latestJob: OutboxJob, overrides: Partial<WhatsAppOutboundDispatchStore> = {}): WhatsAppOutboundDispatchStore {
  return {
    async loadLatestOutboxJob(jobId) {
      expect(jobId).toBe(latestJob.id);
      return latestJob;
    },
    async loadProviderAccount(workspaceId) {
      return { workspaceId, providerAccountRef: "WHATSAPP_BUSINESS_ACCOUNT", phoneNumberId: "123456789" };
    },
    async loadTemplate(templateKey) {
      return templateKey ? { templateKey, locale: "en_US", status: "APPROVED" } : null;
    },
    async recordProviderAcceptance(input) {
      return { status: "RECORDED", result: input.result };
    },
    ...overrides,
  };
}

describe("WhatsApp outbound dispatcher", () => {
  test("rechecks latest handover state immediately before provider send", async () => {
    const queued = queuedJob({ handoverGuard: { conversationId: "conv-1", expectedConversationVersion: 7, handoverActive: false } });
    const latest = queuedJob({ handoverGuard: { conversationId: "conv-1", expectedConversationVersion: 8, handoverActive: true } });
    const calls: Array<Parameters<WhatsAppCloudHttpTransport>[0]> = [];

    const result = await dispatchWhatsAppOutboxJob({
      ctx,
      queuedJob: queued,
      meta,
      config,
      http: acceptingTransport(calls),
      store: store(latest),
    });

    expect(result).toMatchObject({ ok: false, code: "HUMAN_HANDOVER_ACTIVE" });
    expect(calls).toHaveLength(0);
  });

  test("blocks outside-window sends when the template is missing or not approved", async () => {
    const latest = queuedJob({ templateKey: "quote_ready_v1", payload: { lastInboundAt: "2026-10-01T12:00:00.000Z" } });
    const calls: Array<Parameters<WhatsAppCloudHttpTransport>[0]> = [];

    const result = await dispatchWhatsAppOutboxJob({
      ctx,
      queuedJob: latest,
      meta,
      config,
      http: acceptingTransport(calls),
      store: store(latest, {
        async loadTemplate() {
          return { templateKey: "quote_ready_v1", locale: "en_US", status: "CONFIGURED" };
        },
      }),
    });

    expect(result).toMatchObject({ ok: false, code: "WHATSAPP_TEMPLATE_NOT_APPROVED" });
    expect(calls).toHaveLength(0);
  });

  test("dispatches approved template and records provider acceptance exactly once", async () => {
    const latest = queuedJob({ templateKey: "quote_ready_v1", payload: { lastInboundAt: "2026-10-01T12:00:00.000Z" } });
    const calls: Array<Parameters<WhatsAppCloudHttpTransport>[0]> = [];
    const recorded: ProviderSendResult[] = [];

    const result = await dispatchWhatsAppOutboxJob({
      ctx,
      queuedJob: latest,
      meta,
      config,
      http: acceptingTransport(calls),
      store: store(latest, {
        async recordProviderAcceptance(input) {
          recorded.push(input.result);
          return { status: "RECORDED", result: input.result };
        },
      }),
    });

    expect(result.ok).toBe(true);
    expect(calls).toHaveLength(1);
    expect(JSON.parse(calls[0].body)).toMatchObject({ type: "template", template: { name: "quote_ready_v1" } });
    expect(recorded).toHaveLength(1);
    if (result.ok) {
      expect(result.value.deliverySemantics).toBe("PROVIDER_ACCEPTANCE_ONLY");
      expect(result.value.providerMessageId).toBe("wamid.accepted.dispatch");
      expect(JSON.stringify(result.value.evidence)).not.toContain("super-secret-token");
    }
  });

  test("preserves idempotent acceptance result on resend without another business effect", async () => {
    const latest = queuedJob();
    const calls: Array<Parameters<WhatsAppCloudHttpTransport>[0]> = [];
    const accepted: ProviderSendResult = {
      jobId: latest.id,
      providerMessageId: "wamid.accepted.previous",
      acceptedAt: "2026-10-04T12:00:00.000Z",
      mode: "SANDBOX",
      evidence: {
        provider: "WHATSAPP",
        mode: "SANDBOX",
        verification: "CONTRACT_TESTED",
        capturedAt: "2026-10-04T12:00:00.000Z",
        controlledId: "wamid.accepted.previous",
        notes: ["Previously recorded provider acceptance."],
      },
    };

    const result = await dispatchWhatsAppOutboxJob({
      ctx,
      queuedJob: latest,
      meta,
      config,
      http: acceptingTransport(calls),
      store: store(latest, {
        async recordProviderAcceptance() {
          return { status: "DUPLICATE", result: accepted };
        },
      }),
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.providerMessageId).toBe("wamid.accepted.previous");
      expect(result.value.acceptanceRecordStatus).toBe("DUPLICATE");
      expect(result.value.deliverySemantics).toBe("PROVIDER_ACCEPTANCE_ONLY");
    }
  });
});
