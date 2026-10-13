import { describe, expect, test } from "vitest";
import { executeSignedWebhookDelivery, type WebhookExecutorTransport } from "../../src/server/integrations/webhook/executor";
import type { OutboundWebhookEnvelope } from "../../src/server/integrations/webhook/signed";

const envelope: OutboundWebhookEnvelope = {
  id: "evt_booking_1",
  type: "booking.confirmed",
  version: "2026-10-04",
  workspaceId: "ws-clearnest",
  occurredAt: "2026-10-04T10:00:00.000Z",
  payload: { bookingId: "visit_1", customerRef: "customer_ref" },
};

const config = {
  endpointUrl: "https://automation.example.test/webhook/servicedesk",
  signingSecret: "whsec_secret",
  now: () => "2026-10-04T10:00:00.000Z",
  maxAttempts: 3,
  timeoutMs: 1000,
  allowedHosts: ["automation.example.test"],
};

describe("signed outbound webhook executor", () => {
  test("posts signed webhook body with idempotency event id and redacted evidence", async () => {
    let captured: Parameters<WebhookExecutorTransport>[0] | undefined;
    const result = await executeSignedWebhookDelivery(config, { envelope, attempt: 1 }, async (request) => {
      captured = request;
      return { statusCode: 202, body: "{\"ok\":true,\"secret\":\"must-not-appear\"}" };
    });

    expect(result).toMatchObject({ outcome: "DELIVERED", retryable: false, businessMutationAllowed: false });
    expect(captured?.method).toBe("POST");
    expect(captured?.url).toBe(config.endpointUrl);
    expect(captured?.headers["x-servicedesk-event-id"]).toBe("evt_booking_1");
    expect(captured?.headers["x-servicedesk-signature"]).toContain("sha256=");
    expect(JSON.stringify(result)).not.toContain("whsec_secret");
    expect(JSON.stringify(result)).not.toContain("must-not-appear");
  });

  test("blocks untrusted destinations before transport call", async () => {
    let calls = 0;
    const result = await executeSignedWebhookDelivery(
      { ...config, endpointUrl: "https://evil.example.test/hook" },
      { envelope, attempt: 1 },
      async () => {
        calls += 1;
        return { statusCode: 200, body: "ok" };
      },
    );

    expect(result).toMatchObject({ outcome: "FAILED_FINAL", reason: "DESTINATION_NOT_ALLOWED", retryable: false });
    expect(calls).toBe(0);
  });

  test("never posts without an explicit trusted HTTPS host allowlist", async () => {
    let calls=0;
    const http: WebhookExecutorTransport=async()=> {
      calls++;
      return {statusCode:202,body:"ok"};
    };
    for(const override of [
      {allowedHosts:undefined},{allowedHosts:[]},
      {endpointUrl:"https://127.0.0.1/webhook",allowedHosts:["127.0.0.1"]},
      {endpointUrl:"https://localhost/webhook",allowedHosts:["localhost"]},
      {endpointUrl:"https://internal.local/hook",allowedHosts:["internal.local"]},
      {endpointUrl:"https://u:p@automation.example.test/webhook"},
      {endpointUrl:"https://automation.example.test:8443/webhook"},
      {endpointUrl:"https://automation.example.test/webhook#secret"},
    ]) {
      const result=await executeSignedWebhookDelivery(
        {...config,...override},{envelope,attempt:1},http);
      expect(result).toMatchObject({outcome:"FAILED_FINAL",retryable:false});
    }
    expect(calls).toBe(0);
  });

  test("rejects impossible retry counters and invalid signing clocks", async () => {
    let calls=0;
    const http: WebhookExecutorTransport=async()=> {
      calls++;
      return {statusCode:202};
    };
    for(const opt of [
      {attempt:0,maxAttempts:3},{attempt:4,maxAttempts:3},
      {attempt:1,maxAttempts:Infinity},
    ]) {
      const result=await executeSignedWebhookDelivery(
        {...config,maxAttempts:opt.maxAttempts},
        {envelope,attempt:opt.attempt},http);
      expect(result).toMatchObject({outcome:"FAILED_FINAL",retryable:false});
    }
    expect(await executeSignedWebhookDelivery({...config,now:()=> "not-a-clock"},
      {envelope,attempt:1},http)).toMatchObject({
        outcome:"FAILED_FINAL",retryable:false,
      });
    expect(calls).toBe(0);
  });

  test("never exposes provider failure bodies in redacted operator evidence", async () => {
    const result=await executeSignedWebhookDelivery(config,
      {envelope,attempt:1},async()=>({
        statusCode:400,
        body:"secret=sk_live_sensitive, phone=+15551234567, customer=private",
      }));
    expect(result.redactedResponseExcerpt).toBe("[provider-response-redacted]");
    expect(JSON.stringify(result)).not.toContain("sk_live_sensitive");
    expect(JSON.stringify(result)).not.toContain("+15551234567");
  });

  test("classifies timeout as retry with next attempt receipt", async () => {
    const result = await executeSignedWebhookDelivery(config, { envelope, attempt: 1 }, async () => {
      const error = new Error("timeout");
      error.name = "AbortError";
      throw error;
    });

    expect(result).toMatchObject({ outcome: "RETRY", retryable: true, nextAttempt: 2, businessMutationAllowed: false });
    expect(result.nextAttemptAt).toBe("2026-10-04T10:01:00.000Z");
  });

  test("treats deterministic 4xx as final failure and 429/5xx as retryable", async () => {
    const bad = await executeSignedWebhookDelivery(config, { envelope, attempt: 1 }, async () => ({ statusCode: 400, body: "bad payload" }));
    const rate = await executeSignedWebhookDelivery(config, { envelope, attempt: 1 }, async () => ({ statusCode: 429, body: "slow down" }));
    const exhausted = await executeSignedWebhookDelivery(config, { envelope, attempt: 3 }, async () => ({ statusCode: 503, body: "down" }));

    expect(bad).toMatchObject({ outcome: "FAILED_FINAL", retryable: false, reason: "DETERMINISTIC_HTTP_FAILURE" });
    expect(rate).toMatchObject({ outcome: "RETRY", retryable: true, nextAttempt: 2 });
    expect(exhausted).toMatchObject({ outcome: "FAILED_FINAL", retryable: false, reason: "MAX_ATTEMPTS_EXHAUSTED" });
  });
});
