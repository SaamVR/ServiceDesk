import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  describeOwnerModelProbeFailure,
  parseOwnerModelProbe,
} from "../../src/features/operations/ai-owner-model-probe-result";

const valid = {
  state: "PROVIDER_RESPONDED_TO_CONTROLLED_PROBE",
  model: "approved-test-model",
  checkedAt: "2026-10-18T00:00:00Z",
  source: "REAL_MODEL_RESPONSE_NOT_A_PROVIDER_DELIVERY",
  durableReceipt: false,
};

describe("Owner model diagnostic cannot manufacture provider proof", () => {
  it("accepts the exact contracted synthetic response with no durable claim", () => {
    expect(parseOwnerModelProbe(valid)).toEqual(valid);
  });

  it("rejects wrong provider source, fabricated durable receipts or impossible state", () => {
    expect(parseOwnerModelProbe({ ...valid, source: "PROVIDER_DELIVERED" })).toBeNull();
    expect(parseOwnerModelProbe({ ...valid, durableReceipt: true })).toBeNull();
    expect(parseOwnerModelProbe({ ...valid, state: "AUTOMATION_COMPLETED" })).toBeNull();
  });

  it("rejects invalid timestamps and nonstring or control-char model names", () => {
    expect(parseOwnerModelProbe({ ...valid, checkedAt: "not-a-date" })).toBeNull();
    expect(parseOwnerModelProbe({ ...valid, model: "" })).toBeNull();
    expect(parseOwnerModelProbe({ ...valid, model: { value: "test" } })).toBeNull();
    expect(parseOwnerModelProbe({ ...valid, model: "unsafe\nprovider" })).toBeNull();
    expect(parseOwnerModelProbe({ ...valid, model: "x".repeat(121) })).toBeNull();
  });

  it("rejects null, arrays and non-object response bodies", () => {
    expect(parseOwnerModelProbe(null)).toBeNull();
    expect(parseOwnerModelProbe([])).toBeNull();
    expect(parseOwnerModelProbe("success")).toBeNull();
  });

  it("strips unexpected fields instead of rendering arbitrary provider text", () => {
    expect(parseOwnerModelProbe({ ...valid, secret: "MUST_NOT_REACH_UI",
      explanation: "The provider sent a customer message" })).toEqual(valid);
  });

  it("uses safe actionable failure codes without provider body interpolation", () => {
    expect(describeOwnerModelProbeFailure(403)).toContain("not authorized");
    expect(describeOwnerModelProbeFailure(429)).toContain("rate-limited");
    expect(describeOwnerModelProbeFailure(503)).toContain("unavailable");
    expect(describeOwnerModelProbeFailure(504)).toContain("timed out");
    expect(describeOwnerModelProbeFailure(400)).toContain("server-side");
    expect(describeOwnerModelProbeFailure(500)).toContain("could not be verified");
  });

  it("keeps the cancellation and timeout scoped to the owner test, not financial actions", () => {
    const source = readFileSync(join(process.cwd(),
      "src/features/operations/AiOwnerModelProbe.tsx"), "utf8");
    expect(source).toContain("MODEL_PROBE_TIMEOUT_MS = 20_000");
    expect(source).toContain("controller.abort()");
    expect(source).toContain("activeRequest.current === controller");
    expect(source).toContain('credentials: "same-origin"');
    expect(source).toContain('"/api/internal/ai/connection-test"');
    expect(source).toContain("Browser cancellation is not proof");
    expect(source).not.toContain("OPENAI_API_KEY");
    expect(source).not.toContain("SERVICEDESK_CODEX_GATEWAY_KEY");
  });
});
