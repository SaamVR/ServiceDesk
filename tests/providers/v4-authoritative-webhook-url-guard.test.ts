import { describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import type { OutboxJob } from "../../src/server/integrations/types";
import { buildSignedWebhookIntent, type AuthoritativeWebhookDestination } from
  "../../src/server/integrations/webhook/authoritative-destination";

const job = { idempotencyKey: "qa-event-001" } as OutboxJob;
const destination: AuthoritativeWebhookDestination = {
  endpointId: "controlled-hook",
  workflowId: "qa-workflow",
  url: "https://flows.example.com/webhook/controlled",
  allowedHost: "flows.example.com",
  signingSecretRef: "qa-secret-reference",
  signingSecret: "synthetic-secret-never-send",
  body: { event: "qa-only", customer: "fictional" },
};

describe("signed, server-resolved webhook destination", () => {
  it("accepts exact HTTPS host and signs the original body", () => {
    const result = buildSignedWebhookIntent(destination, job);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.url).toBe(destination.url);
    const signedHeaders = result.value.headers ?? {};
    expect(signedHeaders["x-servicedesk-idempotency-key"]).toBe(job.idempotencyKey);
    expect(signedHeaders["x-servicedesk-signature"]).toBe(
      "sha256=" + createHmac("sha256", destination.signingSecret)
        .update(JSON.stringify(destination.body)).digest("hex"),
    );
    expect(JSON.stringify(result.value.evidence)).not.toContain(destination.signingSecret);
  });

  it.each([
    "http://flows.example.com/webhook",
    "https://alice:password@flows.example.com/webhook",
    "https://flows.example.com:8443/webhook",
    "https://flows.example.com/webhook#fragment",
    "https://flows.example.com.attacker.org/webhook",
    "https://localhost/webhook",
    "https://127.0.0.1/webhook",
    " https://flows.example.com/webhook",
    "not-a-url",
  ])("rejects unsafe or noncanonical URL %s", url => {
    const result = buildSignedWebhookIntent({ ...destination, url }, job);
    expect(result).toMatchObject({ ok: false, code: "WEBHOOK_INVALID_DESTINATION" });
    expect(JSON.stringify(result)).not.toContain("synthetic-secret-never-send");
  });

  it.each(["localhost", "127.0.0.1", "flows.example.com.attacker.org", "flows.example.test",
    "flows.example.internal", "flows.example.com:443", "https://flows.example.com"])(
    "requires a DNS allowlist host and exact destination match: %s", allowedHost => {
      const result = buildSignedWebhookIntent({ ...destination, allowedHost }, job);
      expect(result).toMatchObject({ ok: false, code: "WEBHOOK_INVALID_DESTINATION" });
    },
  );

  it("allows ordinary signed webhook headers with legitimate casing", () => {
    const r = buildSignedWebhookIntent({
      ...destination,
      headers: {
        Authorization: "Bearer fictional-controlled-secret",
        "Content-Type": "application/json",
        "x-business-trace": "fictional-123",
      },
    }, job);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.headers?.Authorization).toBe("Bearer fictional-controlled-secret");
      expect(r.value.headers?.["x-servicedesk-idempotency-key"]).toBe(job.idempotencyKey);
    }
  });

  it.each([
    { Host: "attacker.example" },
    { "Content-Length": "1" },
    { "Transfer-Encoding": "chunked" },
    { Cookie: "private-session=secret" },
    { "x-forwarded-host": "attacker.example" },
    { "x-servicedesk-signature": "fake-override" },
    { "bad header": "value" },
    { "X-Workflow-Token": "safe\\r\\ninjected" },
    { "X-Workflow-Token": "bad\\u0000value" },
    { "X-Workflow-Token": "x".repeat(2049) },
  ])("rejects dangerous headers without exposing their values: %j", headers => {
    const r = buildSignedWebhookIntent({ ...destination, headers }, job);
    expect(r).toMatchObject({ ok: false, code: "WEBHOOK_INVALID_HEADERS" });
    expect(JSON.stringify(r)).not.toContain("injected");
    expect(JSON.stringify(r)).not.toContain("synthetic-secret-never-send");
  });

  it("rejects a cyclic, undefined, or oversized outgoing webhook body", () => {
    const cyclic: { self?: unknown } = {};
    cyclic.self = cyclic;
    for (const body of [cyclic, undefined, { data: "x".repeat(131_073) }]) {
      const r = buildSignedWebhookIntent({ ...destination, body }, job);
      expect(r).toMatchObject({ ok: false, code: "WEBHOOK_INVALID_BODY" });
    }
  });

  it("does not accept unsigned destinations", () => {
    const result = buildSignedWebhookIntent({ ...destination, signingSecret: "" }, job);
    expect(result).toMatchObject({ ok: false, code: "WEBHOOK_SIGNING_CONFIG_MISSING" });
  });
});
