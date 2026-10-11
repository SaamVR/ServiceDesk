import { describe, expect, it } from "vitest";
import {
  createConfiguredEmailTransport,
  redactedEmailRequestSummary,
  type EmailHttpRequest,
} from "../../src/server/integrations/email/transport";
import type { TransactionalEmailJob } from "../../src/server/integrations/email/adapter";

const config = {
  endpointUrl: "https://api.resend.com/emails",
  apiKey: "synthetic-test-only-key",
  providerName: "Resend",
  senderAddress: "no-reply@ezcomo.shop",
  mode: "SANDBOX" as const,
  now: () => "2026-10-11T06:00:00.000Z",
};

const job: TransactionalEmailJob = {
  idempotencyKey: "email:synthetic-ws:QUOTE_READY:synthetic-quote",
  workspaceId: "synthetic-ws",
  purpose: "QUOTE_READY",
  to: "controlled-recipient@example.test",
  subject: "Your quote is ready",
  html: "<p>See your quote.</p>",
  text: "See your quote.",
  policy: {},
};

describe("Resend REST transport compatibility", () => {
  it("posts exactly the official Resend message schema without leaking tenant metadata", async () => {
    let request: EmailHttpRequest | undefined;
    const transport = createConfiguredEmailTransport(config, async r => {
      request = r;
      return { status: 200, body: JSON.stringify({ id: "synthetic-message-id" }) };
    });
    const result = await transport.send(job);
    expect(result.ok).toBe(true);
    expect(request?.url).toBe("https://api.resend.com/emails");
    expect(request?.headers["idempotency-key"]).toBe(job.idempotencyKey);
    expect(request?.headers.authorization).toBe("Bearer synthetic-test-only-key");
    expect(JSON.parse(request!.body)).toEqual({
      from: "no-reply@ezcomo.shop",
      to: ["controlled-recipient@example.test"],
      subject: "Your quote is ready",
      text: "See your quote.",
      html: "<p>See your quote.</p>",
    });
    expect(JSON.stringify(result)).not.toContain("controlled-recipient@example.test");
    expect(JSON.stringify(result)).not.toContain("synthetic-test-only-key");
  });

  it("fails closed on a substituted endpoint when configured for Resend", async () => {
    let network = 0;
    const provider = createConfiguredEmailTransport({
      ...config, endpointUrl: "https://email-collection.example.test/emails",
    }, async () => {
      network++;
      return { status: 200, body: JSON.stringify({ id: "unexpected" }) };
    });
    const result = await provider.send(job);
    expect(result).toMatchObject({ ok: false, code: "EMAIL_CONFIGURATION_BLOCKED" });
    expect(network).toBe(0);
  });

  it("rejects HTTP, query strings, non-Resend paths and embedded credentials", async () => {
    for (const endpointUrl of [
      "http://api.resend.com/emails",
      "https://api.resend.com/emails?test=1",
      "https://api.resend.com/emails/batch",
      "https://user:password@api.resend.com/emails",
    ]) {
      const provider = createConfiguredEmailTransport({
        ...config, endpointUrl,
      }, async () => {
        throw new Error("Unexpected provider network call");
      });
      expect(await provider.send(job)).toMatchObject({
        ok: false, code: "EMAIL_CONFIGURATION_BLOCKED",
      });
    }
  });

  it("rejects invalid Resend idempotency keys before network calls", async () => {
    const provider = createConfiguredEmailTransport(config, async () => {
      throw new Error("Unexpected provider network call");
    });
    expect(await provider.send({ ...job, idempotencyKey: "x".repeat(257) })).toMatchObject({
      ok: false, code: "EMAIL_IDEMPOTENCY_KEY_INVALID",
    });
    expect(await provider.send({ ...job, idempotencyKey: " " })).toMatchObject({
      ok: false, code: "EMAIL_IDEMPOTENCY_KEY_INVALID",
    });
  });

  it("rejects header injection, whitespace and non-ASCII idempotency keys before sending", async () => {
    let sends = 0;
    const provider = createConfiguredEmailTransport(config, async () => {
      sends++;
      return { status: 200, body: JSON.stringify({ id: "unexpected" }) };
    });
    for (const unsafe of ["abc\r\nX-Evil: injected", "two words", "tab\tkey", "newline\nkey", "café", " leading", "trailing "]) {
      expect(await provider.send({ ...job, idempotencyKey: unsafe })).toMatchObject({
        ok: false, code: "EMAIL_IDEMPOTENCY_KEY_INVALID",
      });
    }
    expect(sends).toBe(0);
    expect(await provider.send({ ...job, idempotencyKey: "x".repeat(256) })).toMatchObject({ ok: true });
    expect(sends).toBe(1);
  });

  it("rejects malformed, alias-only or untrusted Resend success receipts", async () => {
    const cases = [
      { messageId: "generic-alias-only" },
      { id: "" },
      { id: "embedded\\nnewline" },
      { id: "x".repeat(129) },
      { id: 42 },
      null,
    ];
    for (const body of cases) {
      const provider = createConfiguredEmailTransport(config, async () => ({
        status: 200, body: JSON.stringify(body),
      }));
      const result = await provider.send(job);
      expect(result).toMatchObject({ ok: false, code: "EMAIL_PROVIDER_INVALID_RESPONSE" });
      expect(JSON.stringify(result)).not.toContain("controlled-recipient@example.test");
    }
  });

  it("does not confuse HTTP acceptance with account-verification delivery", async () => {
    const provider = createConfiguredEmailTransport(config, async () => ({
      status: 202, body: JSON.stringify({ id: "synthetic-message-202" }),
    }));
    const result = await provider.send(job);
    expect(result).toMatchObject({
      ok: true,
      value: { providerMessageId: "synthetic-message-202", evidence: { verification: "CONTRACT_TESTED" } },
    });
  });

  it("preserves suppression and response classification without sending", async () => {
    let count = 0;
    const provider = createConfiguredEmailTransport(config, async () => {
      count++;
      return { status: 200, body: JSON.stringify({ id: "not-expected" }) };
    });
    const result = await provider.send({ ...job, policy: { optedOut: true } });
    expect(result).toMatchObject({ ok: false, code: "RECIPIENT_OPTED_OUT" });
    expect(count).toBe(0);
  });

  it("produces metadata-only provider request diagnostics", () => {
    const request: EmailHttpRequest = {
      url: "https://api.resend.com/emails",
      method: "POST",
      headers: { authorization: "Bearer synthetic-test-only-key", "idempotency-key": job.idempotencyKey },
      body: JSON.stringify({
        from: config.senderAddress,
        to: [job.to],
        subject: job.subject,
        html: job.html,
      }),
      signal: new AbortController().signal,
    };
    expect(redactedEmailRequestSummary(request)).toEqual({
      method: "POST",
      host: "api.resend.com",
      endpoint: "/emails",
      hasBearerAuthorization: true,
      hasIdempotencyKey: true,
      bodyKeys: ["from", "html", "subject", "to"],
    });
  });
});
