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
    for(const badTime of [
      "2026-02-30T00:00:00Z","2026-04-31T12:00:00Z",
      "2026-10-18T00:00:00","2026-10-18T00:00:00+14:30",
      "2026-10-18","2026-10-18T24:00:00Z",
    ]) expect(parseOwnerModelProbe({ ...valid, checkedAt: badTime })).toBeNull();
    expect(parseOwnerModelProbe({
      ...valid, checkedAt:"2026-10-18T05:45:00+05:45",
    })?.checkedAt).toBe("2026-10-18T05:45:00+05:45");
    expect(parseOwnerModelProbe({ ...valid, model: "" })).toBeNull();
    expect(parseOwnerModelProbe({ ...valid, model: { value: "test" } })).toBeNull();
    expect(parseOwnerModelProbe({ ...valid, model: "unsafe\nprovider" })).toBeNull();
    expect(parseOwnerModelProbe({ ...valid, model: "provider token=SECRET" })).toBeNull();
    expect(parseOwnerModelProbe({ ...valid, model: "<span>connected</span>" })).toBeNull();
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
    expect(source).toContain("MODEL_PROBE_TIMEOUT_MS = 75_000");
    expect(75_000).toBeGreaterThan(60_000); // bounded Codex maximum + UI overhead
    expect(source).toContain("controller.abort()");
    expect(source).toContain("if (controller.signal.aborted)");
    expect(source).toContain("verified = undefined;");
    expect(source).toContain("if (didTimeout) failure =");
    expect(source).toContain("Transport abort alone cannot guarantee a fetch/JSON promise settles");
    expect(source).toContain("activeRequest.current = null;");
    expect(source).toContain("previous?.scopeKey === submittedScope && previous.busy");
    expect(source).toContain("activeRequest.current === controller");
    expect(source).toContain('credentials: "same-origin"');
    expect(source).toContain('"/api/internal/ai/connection-test"');
    expect(source).toContain("Browser cancellation is not proof");
    expect(source).toContain("Browser HTTP round trip:");
    expect(source).toContain("requestStartedAt = Date.now()");
    expect(source).toContain("Math.max(0,Date.now()-requestStartedAt)");
    expect(source).toContain("not isolated provider inference latency");
    expect(source).toContain("roundTripMs: verified ?");
    expect(source).toContain("!operatorApproved || busy || activeRequest.current");
    expect(source).toContain("setApprovedScope(null)");
    expect(source).toContain("checked={operatorApproved}");
    expect(source).toContain("disabled={!configured || !operatorApproved || busy}");
    expect(source).toContain("can consume tokens or incur provider usage");
    expect(source).toContain('return <ScopedAiOwnerModelProbe key={props.workspaceSlug');
    expect(source).toContain("Scope remount prevents a previous cost acknowledgement");
    expect(source).not.toContain("OPENAI_API_KEY");
    expect(source).not.toContain("SERVICEDESK_CODEX_GATEWAY_KEY");
  });
});
