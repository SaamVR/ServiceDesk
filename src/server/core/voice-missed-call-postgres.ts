import type { MissedVoiceCallEvent, Result, VoiceMissedCallCaptureDTO } from "../../contracts";
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
  };
}
