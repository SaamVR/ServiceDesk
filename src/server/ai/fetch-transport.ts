import type { AiModelHttpRequest, AiModelHttpResponse, AiModelHttpTransport } from "./model-transport";

export const MAX_AI_HTTP_RESPONSE_BYTES = 256 * 1024;

export class AiModelResponseTooLargeError extends Error {
  constructor() {
    super("AI model response exceeded the accepted size limit.");
    this.name = "AiModelResponseTooLargeError";
  }
}

export type AiFetchPort = (input: string, init: RequestInit) => Promise<Response>;

/**
 * Real server-only outbound transport. Provider HTTP bodies and credentials
 * are never logged. Redirects are blocked to prevent forwarding a bearer
 * token to an unexpected host. Only a configured HTTPS origin may be called.
 */
export function createFetchAiModelTransport(
  fetchPort: AiFetchPort = fetch,
): AiModelHttpTransport {
  return async (request: AiModelHttpRequest): Promise<AiModelHttpResponse> => {
    let url: URL;
    try {
      url = new URL(request.url);
    } catch {
      throw new Error("AI_MODEL_HTTP_URL_INVALID");
    }
    // The only permitted non-OpenAI transport is the explicitly reviewed,
    // HTTPS samai Codex Chat Completions gateway. Never accept arbitrary hosts,
    // userinfo, ports, query strings or HTTP->HTTPS redirects with credentials.
    const permitted =
      (url.origin === "https://api.openai.com" &&
        url.pathname === "/v1/responses") ||
      (url.origin === "https://codex-api.ezcomo.shop" &&
        url.pathname === "/v1/chat/completions");
    if (!permitted || url.port || url.username || url.password ||
        url.hash || url.search) {
      throw new Error("AI_MODEL_HTTP_URL_INVALID");
    }

    const response = await fetchPort(url.toString(), {
      method: "POST",
      headers: request.headers,
      body: request.body,
      signal: request.signal,
      redirect: "error",
      cache: "no-store",
    });

    // Provider error bodies may contain customer data or secrets; the
    // caller's status classifier does not need them.
    if (response.status < 200 || response.status >= 300) {
      await response.body?.cancel();
      return { status: response.status, body: "" };
    }

    const declaredLength = Number(response.headers.get("content-length"));
    if (Number.isFinite(declaredLength) &&
        declaredLength > MAX_AI_HTTP_RESPONSE_BYTES) {
      await response.body?.cancel();
      throw new AiModelResponseTooLargeError();
    }

    if (!response.body) {
      const body = await response.text();
      if (new TextEncoder().encode(body).length > MAX_AI_HTTP_RESPONSE_BYTES) {
        throw new AiModelResponseTooLargeError();
      }
      return { status: response.status, body };
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let size = 0;
    let body = "";
    try {
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        size += part.value.byteLength;
        if (size > MAX_AI_HTTP_RESPONSE_BYTES) {
          await reader.cancel();
          throw new AiModelResponseTooLargeError();
        }
        body += decoder.decode(part.value, { stream: true });
      }
      body += decoder.decode();
    } finally {
      reader.releaseLock();
    }
    return { status: response.status, body };
  };
}
