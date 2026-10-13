import { describe, expect, test } from "vitest";
import { createConfiguredEmailTransport, redactedEmailRequestSummary, type EmailHttpTransport } from "../../src/server/integrations/email/transport";
import type { TransactionalEmailJob } from "../../src/server/integrations/email/adapter";

function job(overrides: Partial<TransactionalEmailJob> = {}): TransactionalEmailJob {
  return {
    idempotencyKey: "email:ws-clearnest:quote-1:QUOTE_READY",
    workspaceId: "ws-clearnest",
    purpose: "QUOTE_READY",
    to: "customer@example.test",
    subject: "Your quote is ready",
    html: "<p>Your quote is ready.</p>",
    text: "Your quote is ready.",
    policy: {},
    ...overrides,
  };
}

const config = {
  endpointUrl: "https://email-provider.test/v1/send",
  apiKey: "email_secret_key",
  providerName: "generic-email",
  senderAddress: "no-reply@servicedesk.test",
  mode: "SANDBOX" as const,
  now: () => "2026-10-04T12:00:00.000Z",
};

describe("provider-neutral transactional email transport", () => {
  test("sends normalized transactional payload with idempotency and redacted evidence", async () => {
    let captured: Parameters<EmailHttpTransport>[0] | undefined;
    const adapter = createConfiguredEmailTransport(config, async (request) => {
      captured = request;
      return { status: 202, body: JSON.stringify({ id: "msg_123" }) };
    });

    const result = await adapter.send(job());

    expect(result.ok).toBe(true);
    expect(captured?.method).toBe("POST");
    expect(captured?.url).toBe("https://email-provider.test/v1/send");
    expect(captured?.headers.authorization).toBe("Bearer email_secret_key");
    expect(captured?.headers["idempotency-key"]).toBe("email:ws-clearnest:quote-1:QUOTE_READY");
    const body = JSON.parse(captured?.body ?? "{}");
    expect(body).toMatchObject({
      from: "no-reply@servicedesk.test",
      to: "customer@example.test",
      subject: "Your quote is ready",
      text: "Your quote is ready.",
      html: "<p>Your quote is ready.</p>",
      purpose: "QUOTE_READY",
      workspaceId: "ws-clearnest",
    });
    if (result.ok) {
      expect(result.value.providerMessageId).toBe("msg_123");
      expect(JSON.stringify(result.value.evidence)).not.toContain("email_secret_key");
      expect(JSON.stringify(result.value.evidence)).not.toContain("customer@example.test");
    }
  });

  test("suppresses before provider send and does not call transport", async () => {
    let calls = 0;
    const adapter = createConfiguredEmailTransport(config, async () => {
      calls += 1;
      return { status: 202, body: "{}" };
    });

    const result = await adapter.send(job({ policy: { optedOut: true } }));

    expect(result).toMatchObject({ ok: false, code: "RECIPIENT_OPTED_OUT" });
    expect(calls).toBe(0);
  });

  test("normalizes provider errors without leaking credentials or content", async () => {
    const adapter = createConfiguredEmailTransport(config, async () => ({ status: 429, body: "rate limited" }));
    const result = await adapter.send(job());

    expect(result).toMatchObject({ ok: false, code: "EMAIL_RATE_LIMITED" });
    expect(JSON.stringify(result)).not.toContain("email_secret_key");
    expect(JSON.stringify(result)).not.toContain("Your quote is ready");
  });

  test("refuses oversized or forged provider 2xx acceptance before recording an email receipt", async () => {
    for (const body of [
      "x".repeat(16_385),
      JSON.stringify({ id: "abc" + "x".repeat(300) }),
      JSON.stringify({ id: "message\\nnewline" }),
      JSON.stringify({ id: "message/redirected" }),
      JSON.stringify({ messageId: "fake" + String.fromCharCode(10) + "receipt" }),
      JSON.stringify({ id: [] }),
    ]) {
      const adapter = createConfiguredEmailTransport(config, async () => ({
        status: 202, body,
      }));
      const receipt = await adapter.send(job());
      expect(receipt).toMatchObject({ ok: false, code: "EMAIL_PROVIDER_INVALID_RESPONSE" });
      expect(JSON.stringify(receipt)).not.toContain("email_secret_key");
      expect(JSON.stringify(receipt)).not.toContain("customer@example.test");
    }
  });

  test("retains valid provider-neutral receipt compatibility", async () => {
    const adapter = createConfiguredEmailTransport(config, async () => ({
      status: 200, body: JSON.stringify({ messageId: "email-receipt_123.4" }),
    }));
    const sent = await adapter.send(job());
    expect(sent).toMatchObject({ ok: true, value: { providerMessageId: "email-receipt_123.4" } });
  });

  test("redacts request summary fields for operations", () => {
    const summary = redactedEmailRequestSummary({
      url: "https://email-provider.test/v1/send",
      method: "POST",
      headers: { authorization: "Bearer email_secret_key", "idempotency-key": "email-key" },
      body: JSON.stringify({ to: "customer@example.test", subject: "Private subject", html: "<p>secret</p>" }),
      signal: new AbortController().signal,
    });

    expect(summary).toEqual({
      method: "POST",
      host: "email-provider.test",
      endpoint: "/v1/send",
      hasBearerAuthorization: true,
      hasIdempotencyKey: true,
      bodyKeys: ["html", "subject", "to"],
    });
    expect(JSON.stringify(summary)).not.toContain("email_secret_key");
    expect(JSON.stringify(summary)).not.toContain("customer@example.test");
  });
  test("rejects untrusted email endpoints before attaching provider bearer credentials", async () => {
    let calls = 0;
    for (const endpointUrl of [
      "http://email-provider.test/v1/send",
      "https://user:pass@email-provider.test/v1/send",
      "https://email-provider.test:8443/v1/send",
      "https://127.0.0.1/v1/send",
      "https://localhost/v1/send",
      "https://metadata.internal/v1/send",
      "https://email-provider.test/v1/send#fragment",
      "https://email-provider.test/v1/send?token=x",
    ]) {
      const adapter = createConfiguredEmailTransport({ ...config, endpointUrl }, async () => {
        calls++;
        return { status: 202, body: JSON.stringify({ id: "msg" }) };
      });
      expect(await adapter.send(job())).toMatchObject({ ok: false, code: "EMAIL_CONFIGURATION_BLOCKED" });
    }
    expect(calls).toBe(0);
  });

  test("refuses oversized customer email HTML before any send", async () => {
    let calls = 0;
    const adapter = createConfiguredEmailTransport(config, async () => {
      calls++;
      return { status: 202, body: JSON.stringify({ id: "msg" }) };
    });
    const result = await adapter.send(job({ html: "<p>" + "x".repeat(262_144) + "</p>" }));
    expect(result).toMatchObject({ ok: false, code: "EMAIL_PAYLOAD_TOO_LARGE" });
    expect(calls).toBe(0);
    expect(JSON.stringify(result)).not.toContain("x".repeat(50));
  });
});