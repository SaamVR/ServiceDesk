import type { MissedVoiceCallEvent, Result } from "../../../contracts";

type UnknownRow = Record<string, unknown>;

function fail(code: string, message: string): Result<MissedVoiceCallEvent> {
  return { ok: false, code, message };
}

function row(value: unknown): UnknownRow | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as UnknownRow
    : undefined;
}

function text(input: UnknownRow, key: string): string | undefined {
  const value = input[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function opaqueReference(value: string): boolean {
  return value.length >= 3 && value.length <= 240 && !/[\r\n{}]/.test(value);
}

export function normalizeMissedVoiceCall(
  input: unknown,
  receivedAt: string,
): Result<MissedVoiceCallEvent> {
  const source = row(input);
  if (!source) return fail("VOICE_MISSED_CALL_PAYLOAD_INVALID", "Missed-call payload is invalid.");

  if (
    "transcript" in source
    || "recordingUrl" in source
    || "recordingReference" in source
    || "recordingConsent" in source
  ) {
    return fail(
      "VOICE_MEDIA_NOT_ALLOWED",
      "Recording and transcription are outside the missed-call intake boundary.",
    );
  }

  const workspaceId = text(source, "workspaceId");
  const providerAccountId = text(source, "providerAccountId");
  const providerCallId = text(source, "providerCallId");
  const callerRef = text(source, "callerRef");
  const occurredAt = text(source, "occurredAt");
  const rawProviderEventRef = text(source, "rawProviderEventRef");

  if (!workspaceId) return fail("VOICE_WORKSPACE_REQUIRED", "Workspace identity is required.");
  if (!providerAccountId || providerAccountId.length > 160) {
    return fail("VOICE_ACCOUNT_REQUIRED", "Provider account identity is required.");
  }
  if (!providerCallId || providerCallId.length > 240) {
    return fail("VOICE_CALL_ID_REQUIRED", "Provider call identity is required.");
  }
  if (!callerRef || callerRef.length < 3 || callerRef.length > 160) {
    return fail("VOICE_CALLER_REF_INVALID", "Caller reference is invalid.");
  }
  if (!occurredAt || !Number.isFinite(new Date(occurredAt).getTime())) {
    return fail("VOICE_OCCURRED_AT_INVALID", "Provider call timestamp is invalid.");
  }
  if (!rawProviderEventRef || !opaqueReference(rawProviderEventRef)) {
    return fail("VOICE_RAW_REF_INVALID", "An opaque provider event reference is required.");
  }
  if (!Number.isFinite(new Date(receivedAt).getTime())) {
    return fail("VOICE_RECEIVED_AT_INVALID", "Server receive timestamp is invalid.");
  }

  return {
    ok: true,
    value: {
      workspaceId,
      providerAccountId,
      providerCallId,
      callerRef,
      occurredAt: new Date(occurredAt).toISOString(),
      rawProviderEventRef,
      receivedAt: new Date(receivedAt).toISOString(),
    },
  };
}
