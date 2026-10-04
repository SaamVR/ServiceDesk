import type { Result } from "../../../contracts";

export interface WhatsAppCloudApiConfig {
  graphBaseUrl: string;
  apiVersion: string;
  phoneNumberId: string;
  accessToken: string;
  timeoutMs?: number;
}

export type WhatsAppCloudMessage =
  | { to: string; kind: "text"; text: string }
  | { to: string; kind: "template"; templateName: string; languageCode: string }
  | { to: string; kind: "image"; mediaId: string };

export interface WhatsAppCloudHttpRequest {
  url: string;
  method: "POST";
  headers: Record<string, string>;
  body: string;
  signal: AbortSignal;
}

export interface WhatsAppCloudHttpResponse {
  status: number;
  body: string;
}

export type WhatsAppCloudHttpTransport = (request: WhatsAppCloudHttpRequest) => Promise<WhatsAppCloudHttpResponse>;

export interface WhatsAppCloudAcceptance {
  providerMessageId: string;
}

export interface WhatsAppCloudFailurePolicy {
  retryable: boolean;
  terminal: boolean;
  configurationBlocked: boolean;
}

export function classifyWhatsAppCloudFailure(code: string): WhatsAppCloudFailurePolicy {
  if (code === "WHATSAPP_CONFIGURATION_BLOCKED") {
    return { retryable: false, terminal: true, configurationBlocked: true };
  }
  if (code === "WHATSAPP_RATE_LIMITED" || code === "WHATSAPP_TRANSIENT_FAILURE" || code === "WHATSAPP_TIMEOUT" || code === "WHATSAPP_NETWORK_FAILURE") {
    return { retryable: true, terminal: false, configurationBlocked: false };
  }
  return { retryable: false, terminal: true, configurationBlocked: false };
}

function safeRecipient(value: string): boolean {
  return /^\+?[1-9]\d{6,14}$/.test(value);
}

function messagesUrl(config: WhatsAppCloudApiConfig): string {
  const base = config.graphBaseUrl.replace(/\/+$/, "");
  const version = config.apiVersion.replace(/^\/+|\/+$/g, "");
  return `${base}/${version}/${encodeURIComponent(config.phoneNumberId)}/messages`;
}

function requestBody(message: WhatsAppCloudMessage): Result<Record<string, unknown>> {
  if (!safeRecipient(message.to)) {
    return { ok: false, code: "WHATSAPP_INVALID_RECIPIENT", message: "WhatsApp recipient reference is invalid." };
  }

  if (message.kind === "text") {
    if (!message.text.trim()) return { ok: false, code: "WHATSAPP_EMPTY_TEXT", message: "WhatsApp free-form text is empty." };
    if (message.text.length > 4096) return { ok: false, code: "WHATSAPP_TEXT_TOO_LONG", message: "WhatsApp free-form text exceeds the configured limit." };
    return {
      ok: true,
      value: {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: message.to,
        type: "text",
        text: { body: message.text },
      },
    };
  }

  if (message.kind === "template") {
    if (!message.templateName.trim() || !message.languageCode.trim()) {
      return { ok: false, code: "WHATSAPP_INVALID_TEMPLATE", message: "WhatsApp template name and language are required." };
    }
    return {
      ok: true,
      value: {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: message.to,
        type: "template",
        template: { name: message.templateName, language: { code: message.languageCode } },
      },
    };
  }

  if (!message.mediaId.trim()) {
    return { ok: false, code: "WHATSAPP_INVALID_MEDIA", message: "WhatsApp media ID is required." };
  }
  return {
    ok: true,
    value: {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: message.to,
      type: "image",
      image: { id: message.mediaId },
    },
  };
}

function normalizedHttpFailure(status: number): Result<never> {
  if (status === 401 || status === 403) {
    return { ok: false, code: "WHATSAPP_CONFIGURATION_BLOCKED", message: "WhatsApp provider authentication or authorization failed." };
  }
  if (status === 429) {
    return { ok: false, code: "WHATSAPP_RATE_LIMITED", message: "WhatsApp provider rate limit reached." };
  }
  if (status >= 500) {
    return { ok: false, code: "WHATSAPP_TRANSIENT_FAILURE", message: "WhatsApp provider returned a transient server failure." };
  }
  if (status === 400) {
    return { ok: false, code: "WHATSAPP_INVALID_REQUEST", message: "WhatsApp provider rejected the request or template." };
  }
  return { ok: false, code: "WHATSAPP_PROVIDER_REJECTED", message: "WhatsApp provider rejected the request." };
}

export async function sendWhatsAppCloudMessage(
  config: WhatsAppCloudApiConfig,
  message: WhatsAppCloudMessage,
  http: WhatsAppCloudHttpTransport,
): Promise<Result<WhatsAppCloudAcceptance>> {
  if (!config.graphBaseUrl || !config.apiVersion || !config.phoneNumberId || !config.accessToken) {
    return { ok: false, code: "WHATSAPP_CONFIGURATION_BLOCKED", message: "WhatsApp Cloud API configuration is incomplete." };
  }

  const payload = requestBody(message);
  if (!payload.ok) return payload;

  const controller = new AbortController();
  const timeoutMs = Math.max(250, Math.min(config.timeoutMs ?? 10_000, 30_000));
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await http({
      url: messagesUrl(config),
      method: "POST",
      headers: {
        authorization: `Bearer ${config.accessToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(payload.value),
      signal: controller.signal,
    });

    if (response.status < 200 || response.status >= 300) return normalizedHttpFailure(response.status);

    let parsed: unknown;
    try {
      parsed = JSON.parse(response.body);
    } catch {
      return { ok: false, code: "WHATSAPP_INVALID_RESPONSE", message: "WhatsApp provider returned malformed JSON." };
    }

    const providerMessageId = (parsed as { messages?: Array<{ id?: unknown }> }).messages?.[0]?.id;
    if (typeof providerMessageId !== "string" || !providerMessageId.trim()) {
      return { ok: false, code: "WHATSAPP_INVALID_RESPONSE", message: "WhatsApp provider acceptance response is missing a message ID." };
    }

    return { ok: true, value: { providerMessageId } };
  } catch (error) {
    if (error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError")) {
      return { ok: false, code: "WHATSAPP_TIMEOUT", message: "WhatsApp provider request timed out." };
    }
    return { ok: false, code: "WHATSAPP_NETWORK_FAILURE", message: "WhatsApp provider request failed before a valid response was received." };
  } finally {
    clearTimeout(timeout);
  }
}
