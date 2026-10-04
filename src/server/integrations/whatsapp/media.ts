import type { Result } from "../../../contracts";
import type { RedactedProviderEvidence } from "../types";

export interface WhatsAppInboundMediaReference {
  workspaceId: string;
  phoneNumberId: string;
  providerMessageId: string;
  mediaId: string;
  mediaType: "image";
}

export interface WhatsAppInboundMediaFetchInput {
  workspaceId: string;
  phoneNumberId: string;
  providerMessageId: string;
  mediaId: string;
}

export interface AuthorizedWhatsAppMediaFetch {
  workspaceId: string;
  phoneNumberId: string;
  providerMessageId: string;
  mediaId: string;
  mediaType: "image";
  providerFetchAllowed: true;
}

export interface WhatsAppMediaFetchConfig {
  graphBaseUrl: string;
  apiVersion: string;
  accessToken: string;
  maxBytes: number;
  allowedMimeTypes: string[];
  timeoutMs?: number;
}

export interface WhatsAppMediaHttpRequest {
  url: string;
  method: "GET";
  headers: Record<string, string>;
  signal: AbortSignal;
}

export interface WhatsAppMediaHttpResponse {
  status: number;
  headers: Record<string, string | undefined>;
  bodyText?: string;
  bytes?: Uint8Array;
}

export type WhatsAppMediaHttpTransport = (request: WhatsAppMediaHttpRequest) => Promise<WhatsAppMediaHttpResponse>;

export interface RetrievedWhatsAppMedia {
  workspaceId: string;
  phoneNumberId: string;
  providerMessageId: string;
  mediaId: string;
  mimeType: string;
  sizeBytes: number;
  bytes: Uint8Array;
  evidence: RedactedProviderEvidence;
}

export function authorizeWhatsAppInboundMediaFetch(
  input: WhatsAppInboundMediaFetchInput,
  reference: WhatsAppInboundMediaReference,
): Result<AuthorizedWhatsAppMediaFetch> {
  if (input.workspaceId !== reference.workspaceId) {
    return {
      ok: false,
      code: "WHATSAPP_MEDIA_WORKSPACE_MISMATCH",
      message: "Inbound WhatsApp media does not belong to the requested workspace.",
    };
  }

  if (input.phoneNumberId !== reference.phoneNumberId) {
    return {
      ok: false,
      code: "WHATSAPP_MEDIA_PHONE_MISMATCH",
      message: "Inbound WhatsApp media phone-number mapping does not match the stored message reference.",
    };
  }

  if (input.providerMessageId !== reference.providerMessageId) {
    return {
      ok: false,
      code: "WHATSAPP_MEDIA_MESSAGE_MISMATCH",
      message: "Inbound WhatsApp media is not attached to the requested provider message.",
    };
  }

  if (input.mediaId !== reference.mediaId) {
    return {
      ok: false,
      code: "WHATSAPP_MEDIA_ID_MISMATCH",
      message: "Inbound WhatsApp media ID does not match the stored provider message reference.",
    };
  }

  return {
    ok: true,
    value: {
      workspaceId: reference.workspaceId,
      phoneNumberId: reference.phoneNumberId,
      providerMessageId: reference.providerMessageId,
      mediaId: reference.mediaId,
      mediaType: reference.mediaType,
      providerFetchAllowed: true,
    },
  };
}

function mediaMetadataUrl(config: WhatsAppMediaFetchConfig, mediaId: string): string {
  const base = config.graphBaseUrl.replace(/\/+$/, "");
  const version = config.apiVersion.replace(/^\/+|\/+$/g, "");
  return `${base}/${version}/${encodeURIComponent(mediaId)}`;
}

function httpFailure(status: number): Result<never> {
  if (status === 401 || status === 403) return { ok: false, code: "WHATSAPP_MEDIA_CONFIGURATION_BLOCKED", message: "WhatsApp media provider authentication or authorization failed." };
  if (status === 429) return { ok: false, code: "WHATSAPP_MEDIA_RATE_LIMITED", message: "WhatsApp media provider rate limit reached." };
  if (status >= 500) return { ok: false, code: "WHATSAPP_MEDIA_TRANSIENT_FAILURE", message: "WhatsApp media provider returned a transient server failure." };
  return { ok: false, code: "WHATSAPP_MEDIA_PROVIDER_REJECTED", message: "WhatsApp media provider rejected the request." };
}

function parseJson(text: string | undefined): Result<Record<string, unknown>> {
  if (!text) return { ok: false, code: "WHATSAPP_MEDIA_INVALID_RESPONSE", message: "WhatsApp media metadata response is empty." };
  try {
    const parsed = JSON.parse(text);
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) return { ok: true, value: parsed as Record<string, unknown> };
  } catch {
    // handled below
  }
  return { ok: false, code: "WHATSAPP_MEDIA_INVALID_RESPONSE", message: "WhatsApp media metadata response is malformed." };
}

function normalizedMime(headers: Record<string, string | undefined>, fallback: string): string {
  const raw = headers["content-type"] ?? headers["Content-Type"] ?? fallback;
  return raw.split(";")[0].trim().toLowerCase();
}

async function withTimeout<T>(timeoutMs: number, run: (signal: AbortSignal) => Promise<T>): Promise<Result<T>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.max(250, Math.min(timeoutMs, 30_000)));
  try {
    return { ok: true, value: await run(controller.signal) };
  } catch (error) {
    if (error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError")) {
      return { ok: false, code: "WHATSAPP_MEDIA_TIMEOUT", message: "WhatsApp media provider request timed out." };
    }
    return { ok: false, code: "WHATSAPP_MEDIA_NETWORK_FAILURE", message: "WhatsApp media provider request failed before a valid response was received." };
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchWhatsAppInboundMedia(
  authorization: AuthorizedWhatsAppMediaFetch,
  config: WhatsAppMediaFetchConfig,
  http: WhatsAppMediaHttpTransport,
): Promise<Result<RetrievedWhatsAppMedia>> {
  if (!authorization.providerFetchAllowed || !config.graphBaseUrl || !config.apiVersion || !config.accessToken) {
    return { ok: false, code: "WHATSAPP_MEDIA_CONFIGURATION_BLOCKED", message: "WhatsApp media retrieval configuration is incomplete." };
  }

  const timeoutMs = config.timeoutMs ?? 10_000;
  const metadataResponse = await withTimeout(timeoutMs, (signal) => http({
    url: mediaMetadataUrl(config, authorization.mediaId),
    method: "GET",
    headers: { authorization: `Bearer ${config.accessToken}` },
    signal,
  }));
  if (!metadataResponse.ok) return metadataResponse;
  if (metadataResponse.value.status < 200 || metadataResponse.value.status >= 300) return httpFailure(metadataResponse.value.status);

  const metadata = parseJson(metadataResponse.value.bodyText);
  if (!metadata.ok) return metadata;
  const downloadUrl = typeof metadata.value.url === "string" ? metadata.value.url : undefined;
  const mimeType = typeof metadata.value.mime_type === "string" ? metadata.value.mime_type.toLowerCase() : undefined;
  const declaredSize = typeof metadata.value.file_size === "number" ? metadata.value.file_size : undefined;
  if (!downloadUrl || !mimeType || typeof declaredSize !== "number") {
    return { ok: false, code: "WHATSAPP_MEDIA_INVALID_RESPONSE", message: "WhatsApp media metadata is missing url, mime_type, or file_size." };
  }
  if (!config.allowedMimeTypes.map((type) => type.toLowerCase()).includes(mimeType)) {
    return { ok: false, code: "WHATSAPP_MEDIA_MIME_BLOCKED", message: "WhatsApp media MIME type is not allowed for retrieval." };
  }
  if (declaredSize > config.maxBytes) {
    return { ok: false, code: "WHATSAPP_MEDIA_TOO_LARGE", message: "WhatsApp media exceeds the configured size limit." };
  }

  const downloadResponse = await withTimeout(timeoutMs, (signal) => http({
    url: downloadUrl,
    method: "GET",
    headers: { authorization: `Bearer ${config.accessToken}` },
    signal,
  }));
  if (!downloadResponse.ok) return downloadResponse;
  if (downloadResponse.value.status < 200 || downloadResponse.value.status >= 300) return httpFailure(downloadResponse.value.status);

  const downloadedBytes = downloadResponse.value.bytes ?? new Uint8Array();
  const contentLength = Number(downloadResponse.value.headers["content-length"] ?? downloadResponse.value.headers["Content-Length"] ?? downloadedBytes.byteLength);
  const observedSize = Number.isFinite(contentLength) ? Math.max(contentLength, downloadedBytes.byteLength) : downloadedBytes.byteLength;
  if (observedSize > config.maxBytes || downloadedBytes.byteLength > config.maxBytes) {
    return { ok: false, code: "WHATSAPP_MEDIA_TOO_LARGE", message: "Downloaded WhatsApp media exceeds the configured size limit." };
  }

  const downloadedMime = normalizedMime(downloadResponse.value.headers, mimeType);
  if (!config.allowedMimeTypes.map((type) => type.toLowerCase()).includes(downloadedMime)) {
    return { ok: false, code: "WHATSAPP_MEDIA_MIME_BLOCKED", message: "Downloaded WhatsApp media MIME type is not allowed." };
  }

  return {
    ok: true,
    value: {
      workspaceId: authorization.workspaceId,
      phoneNumberId: authorization.phoneNumberId,
      providerMessageId: authorization.providerMessageId,
      mediaId: authorization.mediaId,
      mimeType: downloadedMime,
      sizeBytes: observedSize,
      bytes: downloadedBytes,
      evidence: {
        provider: "WHATSAPP",
        mode: "SANDBOX",
        verification: "CONTRACT_TESTED",
        capturedAt: new Date(0).toISOString(),
        controlledId: authorization.mediaId,
        notes: ["WhatsApp media retrieval contract exercised with injected transport; no live Meta media receipt is implied.", `MIME ${downloadedMime}; ${observedSize} bytes.`],
      },
    },
  };
}
