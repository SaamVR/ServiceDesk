import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { handleVoiceMissedCallWebhook } from "../../src/server/api-handlers/provider-voice";
import type { VoiceMissedCallCommandPort } from "../../src/server/core/voice-missed-call-postgres";

const secret = "voice-test-secret";
const payload = {
  workspaceId: "workspace-1",
  providerAccountId: "voice-account-1",
  providerCallId: "call-123",
  callerRef: "+15551234567",
  occurredAt: "2026-10-07T01:00:00.000Z",
  rawProviderEventRef: "voice-event:123",
};

function signature(rawBody: string) {
  return "sha256=" + createHmac("sha256", secret).update(rawBody).digest("hex");
}

describe("voice missed-call webhook handler", () => {
  it("verifies signature, normalizes input and applies one missed call", async () => {
    const rawBody = JSON.stringify(payload);
    const applyMissedVoiceCall = vi.fn().mockResolvedValue({
      ok: true,
      value: {
        intakeId: "intake-1",
        requestId: "request-1",
        callbackState: "PENDING",
        duplicate: false,
      },
    });
    const result = await handleVoiceMissedCallWebhook({
      rawBody,
      headers: { "x-servicedesk-voice-signature": signature(rawBody) },
      webhookSecret: secret,
      receivedAt: "2026-10-07T01:00:02.000Z",
      store: { applyMissedVoiceCall } as VoiceMissedCallCommandPort,
    });

    expect(result).toEqual({
      statusCode: 200,
      body: JSON.stringify({
        accepted: true,
        duplicate: false,
        requestId: "request-1",
        callbackState: "PENDING",
      }),
      acknowledged: true,
      retryable: false,
    });
    expect(applyMissedVoiceCall).toHaveBeenCalledWith(expect.objectContaining({
      workspaceId: "workspace-1",
      callerRef: "+15551234567",
      receivedAt: "2026-10-07T01:00:02.000Z",
    }));
  });

  it("rejects invalid signatures without persistence", async () => {
    const applyMissedVoiceCall = vi.fn();
    const result = await handleVoiceMissedCallWebhook({
      rawBody: JSON.stringify(payload),
      headers: { "x-servicedesk-voice-signature": "sha256=00" },
      webhookSecret: secret,
      receivedAt: "2026-10-07T01:00:02.000Z",
      store: { applyMissedVoiceCall } as VoiceMissedCallCommandPort,
    });

    expect(result).toMatchObject({ statusCode: 401, acknowledged: false, retryable: false });
    expect(applyMissedVoiceCall).not.toHaveBeenCalled();
  });

  it("rejects recording/transcript fields before persistence", async () => {
    const applyMissedVoiceCall = vi.fn();
    const rawBody = JSON.stringify({ ...payload, transcript: "not allowed" });
    const result = await handleVoiceMissedCallWebhook({
      rawBody,
      headers: { "x-servicedesk-voice-signature": signature(rawBody) },
      webhookSecret: secret,
      receivedAt: "2026-10-07T01:00:02.000Z",
      store: { applyMissedVoiceCall } as VoiceMissedCallCommandPort,
    });

    expect(result).toMatchObject({ statusCode: 400, acknowledged: false, retryable: false });
    expect(result.body).toContain("VOICE_MEDIA_NOT_ALLOWED");
    expect(applyMissedVoiceCall).not.toHaveBeenCalled();
  });

  it("returns retryable failure only when authoritative persistence fails", async () => {
    const rawBody = JSON.stringify(payload);
    const applyMissedVoiceCall = vi.fn().mockResolvedValue({
      ok: false,
      code: "VOICE_MISSED_CALL_RPC_ERROR",
      message: "database unavailable",
    });
    const result = await handleVoiceMissedCallWebhook({
      rawBody,
      headers: { "x-servicedesk-voice-signature": signature(rawBody) },
      webhookSecret: secret,
      receivedAt: "2026-10-07T01:00:02.000Z",
      store: { applyMissedVoiceCall } as VoiceMissedCallCommandPort,
    });

    expect(result).toMatchObject({ statusCode: 503, acknowledged: false, retryable: true });
  });
});
