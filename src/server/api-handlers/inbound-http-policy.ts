export const MAX_INBOUND_WEBHOOK_BYTES = 256 * 1024;
export const INBOUND_RETRY_AFTER_SECONDS = 30;

export type BoundedWebhookBodyResult =
  | { ok: true; rawBody: string }
  | { ok: false; statusCode: 413; body: string };

export async function readBoundedWebhookBody(
  request: Request,
  maxBytes = MAX_INBOUND_WEBHOOK_BYTES,
): Promise<BoundedWebhookBodyResult> {
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    return {
      ok: false,
      statusCode: 413,
      body: "Webhook payload exceeds the accepted size limit.",
    };
  }

  if (!request.body) {
    return { ok: true, rawBody: "" };
  }

  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let totalBytes = 0;
  let rawBody = "";

  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    totalBytes += chunk.value.byteLength;
    if (totalBytes > maxBytes) {
      await reader.cancel();
      return {
        ok: false,
        statusCode: 413,
        body: "Webhook payload exceeds the accepted size limit.",
      };
    }
    rawBody += decoder.decode(chunk.value, { stream: true });
  }

  rawBody += decoder.decode();
  return { ok: true, rawBody };
}

export function inboundWebhookResponse(input: {
  statusCode: number;
  body?: string;
  retryable: boolean;
}): Response {
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  if (input.retryable && input.statusCode >= 500) {
    headers.set("Retry-After", String(INBOUND_RETRY_AFTER_SECONDS));
  }

  return new Response(input.body, {
    status: input.statusCode,
    headers,
  });
}
