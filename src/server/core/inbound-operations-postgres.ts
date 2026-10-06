import type {
  ActorContext,
  InboundMessageChannelOperationsDTO,
  InboundOperationsSnapshotDTO,
  Result,
} from "../../contracts";
import type { SupabaseRpcClient } from "./payment-application-postgres";

type Row = Record<string, unknown>;

function fail<T>(code: string, message: string): Result<T> {
  return { ok: false, code, message };
}

function text(row: Row, key: string): string | undefined {
  const value = row[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function count(row: Row, key: string): number {
  const value = row[key];
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(`Malformed inbound operations response: ${key}`);
  }
  return value;
}

function channel(row: Row): InboundMessageChannelOperationsDTO {
  const value = row.channel;
  if (value !== "EMAIL" && value !== "WHATSAPP") {
    throw new Error("Malformed inbound operations response: channel");
  }
  return {
    channel: value,
    receivedCount: count(row, "receivedCount"),
    appliedCount: count(row, "appliedCount"),
    duplicateCount: count(row, "duplicateCount"),
    ignoredCount: count(row, "ignoredCount"),
    unresolvedIdentityCount: count(row, "unresolvedIdentityCount"),
    latestReceivedAt: text(row, "latestReceivedAt"),
  };
}

export interface InboundOperationsReadPort {
  readInboundOperationsSnapshot(
    ctx: ActorContext,
    input?: { windowHours?: number; now?: string },
  ): Promise<Result<InboundOperationsSnapshotDTO>>;
}

export function createPostgresInboundOperationsReadPort(
  client: SupabaseRpcClient,
): InboundOperationsReadPort {
  return {
    async readInboundOperationsSnapshot(ctx, input = {}) {
      if (!ctx.userId || !["OWNER", "DISPATCHER"].includes(ctx.role)) {
        return fail("FORBIDDEN", "Owner or dispatcher access is required to read inbound operations.");
      }
      const windowHours = input.windowHours ?? 24;
      if (!Number.isInteger(windowHours) || windowHours < 1 || windowHours > 168) {
        return fail("INBOUND_OBSERVABILITY_WINDOW_INVALID", "Inbound operations window must be between 1 and 168 hours.");
      }
      const now = input.now ?? new Date().toISOString();
      const { data, error } = await client.rpc<Row>(
        "servicedesk_read_inbound_operations_snapshot",
        {
          p_input: {
            workspaceId: ctx.workspaceId,
            actorUserId: ctx.userId,
            actorRole: ctx.role,
            windowHours,
            now,
          },
        },
      );
      if (error) return fail(error.code ?? "INBOUND_OBSERVABILITY_RPC_ERROR", error.message);
      if (!data) return fail("INBOUND_OBSERVABILITY_RPC_EMPTY", "Inbound operations returned no payload.");
      if (data.ok === false) {
        return fail(String(data.code ?? "INBOUND_OBSERVABILITY_REJECTED"), "Inbound operations read was rejected.");
      }
      try {
        const messageRows = Array.isArray(data.messageChannels)
          ? data.messageChannels.filter((value): value is Row => Boolean(value) && typeof value === "object" && !Array.isArray(value))
          : [];
        const voice = data.voice && typeof data.voice === "object" && !Array.isArray(data.voice)
          ? data.voice as Row
          : {};
        const snapshot: InboundOperationsSnapshotDTO = {
          workspaceId: String(data.workspaceId),
          windowHours: count(data, "windowHours"),
          windowStartedAt: String(data.windowStartedAt),
          generatedAt: String(data.generatedAt),
          messageChannels: messageRows.map(channel),
          voice: {
            capturedCount: count(voice, "capturedCount"),
            pendingCallbackCount: count(voice, "pendingCallbackCount"),
            resolvedCallbackCount: count(voice, "resolvedCallbackCount"),
            latestOccurredAt: text(voice, "latestOccurredAt"),
          },
        };
        if (snapshot.workspaceId !== ctx.workspaceId || snapshot.messageChannels.length !== 2) {
          throw new Error("Malformed inbound operations response: workspace or channels");
        }
        return { ok: true, value: snapshot };
      } catch (error) {
        return fail(
          "INBOUND_OBSERVABILITY_RPC_MALFORMED",
          error instanceof Error ? error.message : "Malformed inbound operations response.",
        );
      }
    },
  };
}
