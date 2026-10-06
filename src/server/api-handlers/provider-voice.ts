import { createHmac, timingSafeEqual } from "node:crypto";
import type { VoiceMissedCallCommandPort } from "../core/voice-missed-call-postgres";
import { normalizeMissedVoiceCall } from "../integrations/voice/missed-call-normalization";

export interface VoiceProviderHandlerResult {
  statusCode: number;
  body?: string;
  acknowledged: boolean;
  retryable: boolean;
}

export interface VoiceMissedCallWebhookInput {
  rawBody: string;
  headers: Record<string, string | undefined>;
  webhookSecret: string;
  receivedAt: string;
  store: VoiceMissedCallCommandPort;
}

function header(headers: Record<string, string | undefined>, name: string): string | undefined {
  const exact = headers[name];
  if (exact) return exact;
  return Object.entries(headers).find(([key]) => key.toLowerCase() === name.toLowerCase())?.[1];
}

function verifySignature(rawBody: string, signatureHeader: string | undefined, secret: string): boolean {
  if (!signatureHeader?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const received = signatureHeader.slice("sha256=".length);
  const expectedBuffer = Buffer.from(expected, "hex");
  const receivedBuffer = Buffer.from(received, "hex");
  return expectedBuffer.length === receivedBuffer.length && timingSafeEqual(expectedBuffer, receivedBuffer);
}

export async function handleVoiceMissedCallWebhook(
  input: VoiceMissedCallWebhookInput,
): Promise<VoiceProviderHandlerResult> {
  const signature = header(input.headers, "x-servicedesk-voice-signature");
  if (!verifySignature(input.rawBody, signature, input.webhookSecret)) {
    return {
      statusCode: 401,
      body: "Voice webhook signature missing or invalid.",
      acknowledged: false,
      retryable: false,
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(input.rawBody);
  } catch {
    return {
      statusCode: 400,
      body: "Malformed voice webhook JSON.",
      acknowledged: false,
      retryable: false,
    };
  }

  const normalized = normalizeMissedVoiceCall(parsed, input.receivedAt);
  if (!normalized.ok) {
    return {
      statusCode: 400,
      body: `${normalized.code}: ${normalized.message}`,
      acknowledged: false,
      retryable: false,
    };
  }

  const applied = await input.store.applyMissedVoiceCall(normalized.value);
  if (!applied.ok) {
    return {
      statusCode: 503,
      body: `${applied.code}: Missed-call persistence failed.`,
      acknowledged: false,
      retryable: true,
    };
  }

  return {
    statusCode: 200,
    body: JSON.stringify({
      accepted: true,
      duplicate: applied.value.duplicate,
      requestId: applied.value.requestId,
      callbackState: applied.value.callbackState,
    }),
    acknowledged: true,
    retryable: false,
  };
}
