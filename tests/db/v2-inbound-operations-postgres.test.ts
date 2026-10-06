import { describe, expect, it, vi } from "vitest";
import { createPostgresInboundOperationsReadPort } from "../../src/server/core/inbound-operations-postgres";
import type { SupabaseRpcClient } from "../../src/server/core/payment-application-postgres";

const ctx = { workspaceId: "workspace-1", userId: "user-1", role: "DISPATCHER" as const };

describe("inbound operations postgres read boundary", () => {
  it("maps privacy-safe aggregate inbound operations", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        ok: true,
        workspaceId: "workspace-1",
        windowHours: 24,
        windowStartedAt: "2026-10-06T00:00:00.000Z",
        generatedAt: "2026-10-07T00:00:00.000Z",
        messageChannels: [
          { channel: "EMAIL", receivedCount: 8, appliedCount: 7, duplicateCount: 1, ignoredCount: 0, unresolvedIdentityCount: 2, latestReceivedAt: "2026-10-06T23:00:00.000Z" },
          { channel: "WHATSAPP", receivedCount: 5, appliedCount: 5, duplicateCount: 0, ignoredCount: 0, unresolvedIdentityCount: 0, latestReceivedAt: "2026-10-06T22:00:00.000Z" },
        ],
        voice: { capturedCount: 3, pendingCallbackCount: 1, resolvedCallbackCount: 2, latestOccurredAt: "2026-10-06T21:00:00.000Z" },
      },
      error: null,
    });
    const port = createPostgresInboundOperationsReadPort({ rpc } as SupabaseRpcClient);
    const result = await port.readInboundOperationsSnapshot(ctx, { windowHours: 24, now: "2026-10-07T00:00:00.000Z" });

    expect(result).toMatchObject({
      ok: true,
      value: {
        workspaceId: "workspace-1",
        messageChannels: [
          { channel: "EMAIL", receivedCount: 8, unresolvedIdentityCount: 2 },
          { channel: "WHATSAPP", receivedCount: 5 },
        ],
        voice: { capturedCount: 3, pendingCallbackCount: 1 },
      },
    });
    expect(rpc).toHaveBeenCalledWith("servicedesk_read_inbound_operations_snapshot", {
      p_input: expect.objectContaining({ workspaceId: "workspace-1", actorRole: "DISPATCHER", windowHours: 24 }),
    });
  });

  it("rejects invalid windows before RPC execution", async () => {
    const rpc = vi.fn();
    const port = createPostgresInboundOperationsReadPort({ rpc } as SupabaseRpcClient);
    expect(await port.readInboundOperationsSnapshot(ctx, { windowHours: 0 })).toMatchObject({
      ok: false,
      code: "INBOUND_OBSERVABILITY_WINDOW_INVALID",
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("fails closed on malformed channel responses", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        ok: true,
        workspaceId: "workspace-1",
        windowHours: 24,
        windowStartedAt: "2026-10-06T00:00:00.000Z",
        generatedAt: "2026-10-07T00:00:00.000Z",
        messageChannels: [{ channel: "SMS", receivedCount: 1, appliedCount: 1, duplicateCount: 0, ignoredCount: 0, unresolvedIdentityCount: 0 }],
        voice: { capturedCount: 0, pendingCallbackCount: 0, resolvedCallbackCount: 0 },
      },
      error: null,
    });
    const port = createPostgresInboundOperationsReadPort({ rpc } as SupabaseRpcClient);
    expect(await port.readInboundOperationsSnapshot(ctx)).toMatchObject({
      ok: false,
      code: "INBOUND_OBSERVABILITY_RPC_MALFORMED",
    });
  });
});
