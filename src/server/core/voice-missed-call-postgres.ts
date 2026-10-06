import type {
  ActorContext,
  MissedVoiceCallEvent,
  Result,
  VoiceCallbackState,
  VoiceCallbackUpdateDTO,
  VoiceMissedCallCaptureDTO,
} from "../../contracts";
import type { SupabaseRpcClient } from "./payment-application-postgres";

type RpcRow = Record<string, unknown>;

function fail<T>(code: string, message: string): Result<T> {
  return { ok: false, code, message };
}

function text(row: RpcRow, key: string): string {
  const value = row[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Malformed missed-call response: ${key}`);
  }
  return value;
}

export interface VoiceMissedCallCommandPort {
  applyMissedVoiceCall(event: MissedVoiceCallEvent): Promise<Result<VoiceMissedCallCaptureDTO>>;
  setVoiceCallbackState(
    ctx: ActorContext,
    input: { intakeId: string; state: VoiceCallbackState; now: string },
  ): Promise<Result<VoiceCallbackUpdateDTO>>;
}

export function createPostgresVoiceMissedCallCommandPort(
  client: SupabaseRpcClient,
): VoiceMissedCallCommandPort {
  return {
    async applyMissedVoiceCall(event) {
      const { data, error } = await client.rpc<RpcRow>(
        "servicedesk_apply_missed_voice_call",
        { p_event: event },
      );

      if (error) return fail(error.code ?? "VOICE_MISSED_CALL_RPC_ERROR", error.message);
      if (!data) return fail("VOICE_MISSED_CALL_RPC_EMPTY", "Missed-call intake returned no payload.");
      if (data.ok === false) {
        return fail(
          String(data.code ?? "VOICE_MISSED_CALL_REJECTED"),
          "Missed-call intake was rejected by the authoritative database boundary.",
        );
      }

      try {
        const callbackState = text(data, "callbackState");
        if (callbackState !== "PENDING" && callbackState !== "RESOLVED") {
          throw new Error("Malformed missed-call response: callbackState");
        }
        return {
          ok: true,
          value: {
            intakeId: text(data, "intakeId"),
            requestId: text(data, "requestId"),
            callbackState,
            duplicate: data.duplicate === true,
          },
        };
      } catch (error) {
        return fail(
          "VOICE_MISSED_CALL_RPC_MALFORMED",
          error instanceof Error ? error.message : "Malformed missed-call response.",
        );
      }
    },
    async setVoiceCallbackState(ctx, input) {
      if (!ctx.userId || !["OWNER", "DISPATCHER"].includes(ctx.role)) {
        return fail("FORBIDDEN", "Owner or dispatcher access is required to update callback tasks.");
      }

      const { data, error } = await client.rpc<RpcRow>(
        "servicedesk_set_voice_callback_state",
        {
          p_input: {
            workspaceId: ctx.workspaceId,
            actorUserId: ctx.userId,
            actorRole: ctx.role,
            intakeId: input.intakeId,
            state: input.state,
            now: input.now,
          },
        },
      );

      if (error) return fail(error.code ?? "VOICE_CALLBACK_RPC_ERROR", error.message);
      if (!data) return fail("VOICE_CALLBACK_RPC_EMPTY", "Callback task update returned no payload.");
      if (data.ok === false) {
        return fail(
          String(data.code ?? "VOICE_CALLBACK_REJECTED"),
          "Callback task update was rejected by the authoritative database boundary.",
        );
      }

      try {
        const callbackState = text(data, "callbackState");
        if (callbackState !== "PENDING" && callbackState !== "RESOLVED") {
          throw new Error("Malformed missed-call response: callbackState");
        }
        const version = data.version;
        if (typeof version !== "number" || !Number.isFinite(version) || version < 1) {
          throw new Error("Malformed missed-call response: version");
        }
        return {
          ok: true,
          value: {
            intakeId: text(data, "intakeId"),
            requestId: text(data, "requestId"),
            callbackState,
            version,
            duplicate: data.duplicate === true,
          },
        };
      } catch (error) {
        return fail(
          "VOICE_CALLBACK_RPC_MALFORMED",
          error instanceof Error ? error.message : "Malformed callback-task response.",
        );
      }
    }
  };
}
