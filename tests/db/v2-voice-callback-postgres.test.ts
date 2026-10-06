import { describe, expect, it, vi } from "vitest";
import { createPostgresVoiceMissedCallCommandPort } from "../../src/server/core/voice-missed-call-postgres";
import type { SupabaseRpcClient } from "../../src/server/core/payment-application-postgres";

const owner = { workspaceId: "workspace-1", userId: "owner-1", role: "OWNER" as const };

describe("voice callback postgres boundary", () => {
  it("records callback completion through the authoritative RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        ok: true,
        duplicate: false,
        intakeId: "intake-1",
        requestId: "request-1",
        callbackState: "RESOLVED",
        version: 2,
      },
      error: null,
    });
    const port = createPostgresVoiceMissedCallCommandPort({ rpc } as SupabaseRpcClient);
    const result = await port.setVoiceCallbackState(owner, {
      intakeId: "intake-1",
      state: "RESOLVED",
      now: "2026-10-07T02:00:00.000Z",
    });

    expect(result).toEqual({
      ok: true,
      value: {
        intakeId: "intake-1",
        requestId: "request-1",
        callbackState: "RESOLVED",
        version: 2,
        duplicate: false,
      },
    });
    expect(rpc).toHaveBeenCalledWith(
      "servicedesk_set_voice_callback_state",
      {
        p_input: {
          workspaceId: "workspace-1",
          actorUserId: "owner-1",
          actorRole: "OWNER",
          intakeId: "intake-1",
          state: "RESOLVED",
          now: "2026-10-07T02:00:00.000Z",
        },
      },
    );
  });

  it("preserves idempotent duplicate state", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        ok: true,
        duplicate: true,
        intakeId: "intake-1",
        requestId: "request-1",
        callbackState: "PENDING",
        version: 3,
      },
      error: null,
    });
    const port = createPostgresVoiceMissedCallCommandPort({ rpc } as SupabaseRpcClient);
    const result = await port.setVoiceCallbackState(owner, {
      intakeId: "intake-1",
      state: "PENDING",
      now: "2026-10-07T02:00:00.000Z",
    });

    expect(result).toMatchObject({ ok: true, value: { duplicate: true, callbackState: "PENDING", version: 3 } });
  });

  it("blocks non-staff callers before RPC mutation", async () => {
    const rpc = vi.fn();
    const port = createPostgresVoiceMissedCallCommandPort({ rpc } as SupabaseRpcClient);
    const result = await port.setVoiceCallbackState(
      { workspaceId: "workspace-1", userId: "crew-1", role: "CREW" },
      { intakeId: "intake-1", state: "RESOLVED", now: "2026-10-07T02:00:00.000Z" },
    );

    expect(result).toMatchObject({ ok: false, code: "FORBIDDEN" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("fails closed on malformed state/version responses", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        ok: true,
        duplicate: false,
        intakeId: "intake-1",
        requestId: "request-1",
        callbackState: "UNKNOWN",
        version: 0,
      },
      error: null,
    });
    const port = createPostgresVoiceMissedCallCommandPort({ rpc } as SupabaseRpcClient);
    const result = await port.setVoiceCallbackState(owner, {
      intakeId: "intake-1",
      state: "RESOLVED",
      now: "2026-10-07T02:00:00.000Z",
    });

    expect(result).toMatchObject({ ok: false, code: "VOICE_CALLBACK_RPC_MALFORMED" });
  });
});
