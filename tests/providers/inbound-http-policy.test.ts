import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  INBOUND_RETRY_AFTER_SECONDS,
  MAX_INBOUND_WEBHOOK_BYTES,
  inboundWebhookResponse,
  readBoundedWebhookBody,
} from "../../src/server/api-handlers/inbound-http-policy";

describe("inbound webhook HTTP recovery policy", () => {
  it("streams request bodies instead of buffering before enforcing the limit", () => {
    const source = readFileSync(
      join(process.cwd(), "src/server/api-handlers/inbound-http-policy.ts"),
      "utf8",
    );
    expect(source).toContain("request.body.getReader()");
    expect(source).toContain("totalBytes += chunk.value.byteLength");
    expect(source).not.toContain("request.text()");
  });

  it("rejects declared oversized payloads with 413", async () => {
    const request = new Request("https://example.test/inbound", {
      method: "POST",
      headers: { "content-length": String(MAX_INBOUND_WEBHOOK_BYTES + 1) },
      body: "{}",
    });
    const result = await readBoundedWebhookBody(request);
    expect(result).toMatchObject({ ok: false, statusCode: 413 });
  });

  it("rejects oversized bodies even without a trustworthy content-length header", async () => {
    const request = new Request("https://example.test/inbound", {
      method: "POST",
      body: "x".repeat(33),
    });
    const result = await readBoundedWebhookBody(request, 32);
    expect(result).toMatchObject({ ok: false, statusCode: 413 });
  });

  it("adds Retry-After only to retryable server failures", () => {
    const retry = inboundWebhookResponse({
      statusCode: 503,
      body: "temporarily unavailable",
      retryable: true,
    });
    expect(retry.headers.get("retry-after")).toBe(String(INBOUND_RETRY_AFTER_SECONDS));
    expect(retry.headers.get("cache-control")).toBe("no-store");
    expect(retry.headers.get("x-content-type-options")).toBe("nosniff");

    const invalid = inboundWebhookResponse({
      statusCode: 400,
      body: "invalid payload",
      retryable: false,
    });
    expect(invalid.headers.get("retry-after")).toBeNull();
  });

  it("does not ask providers to retry successful duplicate acknowledgements", () => {
    const duplicate = inboundWebhookResponse({
      statusCode: 200,
      body: JSON.stringify({ accepted: true, state: "DUPLICATE" }),
      retryable: false,
    });
    expect(duplicate.status).toBe(200);
    expect(duplicate.headers.get("retry-after")).toBeNull();
  });
});
