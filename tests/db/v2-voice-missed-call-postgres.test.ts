import { describe, expect, it, vi } from "vitest";
import { createPostgresVoiceMissedCallCommandPort } from "../../src/server/core/voice-missed-call-postgres";
import type { SupabaseRpcClient } from "../../src/server/core/payment-application-postgres";

const event = {
  workspaceId: "workspace-1",
  providerAccountId: "voice-account-1",
  providerCallId: "call-123",
  callerRef: "+15551234567",
  occurredAt: "2026-10-07T01:00:00.000Z",
  rawProviderEventRef: "voice-event:123",
  receivedAt: "2026-10-07T01:00:02.000Z",
};

describe("missed-call postgres boundary", () => {
  it("maps a newly captured missed call", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        ok: true,
        duplicate: false,
        intakeId: "intake-1",
        requestId: "request-1",
        callbackState: "PENDING",
      },
      error: null,
    });
    const port = createPostgresVoiceMissedCallCommandPort({ rpc } as SupabaseRpcClient);
    const result = await port.applyMissedVoiceCall(event);

    expect(result).toEqual({
      ok: true,
      value: {
        intakeId: "intake-1",
        requestId: "request-1",
        callbackState: "PENDING",
        duplicate: false,
      },
    });
    expect(rpc).toHaveBeenCalledWith("servicedesk_apply_missed_voice_call", { p_event: event });
  });

  it("preserves duplicate semantics", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        ok: true,
        duplicate: true,
        intakeId: "intake-1",
        requestId: "request-1",
        callbackState: "PENDING",
      },
      error: null,
    });
    const port = createPostgresVoiceMissedCallCommandPort({ rpc } as SupabaseRpcClient);
    const result = await port.applyMissedVoiceCall(event);
    expect(result).toMatchObject({ ok: true, value: { duplicate: true } });
  });

  it("fails closed on malformed command responses", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { ok: true, intakeId: "intake-1", requestId: "request-1", callbackState: "UNKNOWN" },
      error: null,
    });
    const port = createPostgresVoiceMissedCallCommandPort({ rpc } as SupabaseRpcClient);
    const result = await port.applyMissedVoiceCall(event);
    expect(result).toMatchObject({ ok: false, code: "VOICE_MISSED_CALL_RPC_MALFORMED" });
  });
});
