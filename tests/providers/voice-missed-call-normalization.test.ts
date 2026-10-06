import { describe, expect, it } from "vitest";
import { normalizeMissedVoiceCall } from "../../src/server/integrations/voice/missed-call-normalization";

const payload = {
  workspaceId: "workspace-1",
  providerAccountId: "voice-account-1",
  providerCallId: "call-123",
  callerRef: "+15551234567",
  occurredAt: "2026-10-07T01:00:00.000Z",
  rawProviderEventRef: "voice-event:123",
};

describe("missed voice call normalization", () => {
  it("normalizes the provider-neutral envelope", () => {
    expect(normalizeMissedVoiceCall(payload, "2026-10-07T01:00:02.000Z")).toEqual({
      ok: true,
      value: {
        ...payload,
        occurredAt: "2026-10-07T01:00:00.000Z",
        receivedAt: "2026-10-07T01:00:02.000Z",
      },
    });
  });

  it("rejects recording or transcript material before persistence", () => {
    expect(normalizeMissedVoiceCall({ ...payload, transcript: "hello" }, "2026-10-07T01:00:02.000Z"))
      .toMatchObject({ ok: false, code: "VOICE_MEDIA_NOT_ALLOWED" });
    expect(normalizeMissedVoiceCall({ ...payload, recordingUrl: "https://example.test/audio" }, "2026-10-07T01:00:02.000Z"))
      .toMatchObject({ ok: false, code: "VOICE_MEDIA_NOT_ALLOWED" });
  });

  it("rejects malformed identities and timestamps", () => {
    expect(normalizeMissedVoiceCall({ ...payload, callerRef: "" }, "2026-10-07T01:00:02.000Z"))
      .toMatchObject({ ok: false, code: "VOICE_CALLER_REF_INVALID" });
    expect(normalizeMissedVoiceCall({ ...payload, occurredAt: "invalid" }, "2026-10-07T01:00:02.000Z"))
      .toMatchObject({ ok: false, code: "VOICE_OCCURRED_AT_INVALID" });
    expect(normalizeMissedVoiceCall(payload, "invalid"))
      .toMatchObject({ ok: false, code: "VOICE_RECEIVED_AT_INVALID" });
  });

  it("rejects raw provider payload text masquerading as an opaque event reference", () => {
    expect(normalizeMissedVoiceCall({ ...payload, rawProviderEventRef: '{"call":"raw"}' }, "2026-10-07T01:00:02.000Z"))
      .toMatchObject({ ok: false, code: "VOICE_RAW_REF_INVALID" });
  });
});
