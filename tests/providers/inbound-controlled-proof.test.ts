import { describe, expect, it } from "vitest";
import {
  parseInboundControlledProof,
  validateInboundControlledProof,
} from "../../src/server/integrations/readiness/inbound-proof";

const buildSha = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const now = "2026-10-07T00:00:00.000Z";

function manifest(overrides: Record<string, unknown> = {}) {
  return {
    channel: "EMAIL_INBOUND",
    operation: "SIGNED_INBOUND_CAPTURE",
    route: "/api/providers/email/inbound",
    buildSha,
    capturedAt: "2026-10-06T23:00:00.000Z",
    redactedProviderReceipt: "receipt:redacted:123",
    result: "PASS",
    evidenceKind: "CONTROLLED_PROVIDER_RECEIPT",
    ...overrides,
  };
}

describe("controlled inbound proof validation", () => {
  it("accepts fresh route- and build-bound controlled provider evidence", () => {
    expect(validateInboundControlledProof({
      channel: "EMAIL_INBOUND",
      manifest: manifest() as never,
      expectedBuildSha: buildSha,
      now,
    })).toEqual({ allowed: true, code: "PROOF_ACCEPTED" });
  });

  it("rejects proof from another channel, route, build, or failed run", () => {
    expect(validateInboundControlledProof({
      channel: "VOICE_INBOUND",
      manifest: manifest() as never,
      expectedBuildSha: buildSha,
      now,
    }).code).toBe("PROOF_CHANNEL_MISMATCH");
    expect(validateInboundControlledProof({
      channel: "EMAIL_INBOUND",
      manifest: manifest({ route: "/api/providers/voice/inbound" }) as never,
      expectedBuildSha: buildSha,
      now,
    }).code).toBe("PROOF_ROUTE_MISMATCH");
    expect(validateInboundControlledProof({
      channel: "EMAIL_INBOUND",
      manifest: manifest({ buildSha: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" }) as never,
      expectedBuildSha: buildSha,
      now,
    }).code).toBe("PROOF_BUILD_MISMATCH");
    expect(validateInboundControlledProof({
      channel: "EMAIL_INBOUND",
      manifest: manifest({ result: "FAIL" }) as never,
      expectedBuildSha: buildSha,
      now,
    }).code).toBe("PROOF_RESULT_NOT_PASS");
  });

  it("rejects stale or secret-like evidence", () => {
    expect(validateInboundControlledProof({
      channel: "EMAIL_INBOUND",
      manifest: manifest({ capturedAt: "2026-10-01T00:00:00.000Z" }) as never,
      expectedBuildSha: buildSha,
      now,
    }).code).toBe("PROOF_STALE");
    expect(validateInboundControlledProof({
      channel: "EMAIL_INBOUND",
      manifest: manifest({ redactedProviderReceipt: "api_key=supersecret" }) as never,
      expectedBuildSha: buildSha,
      now,
    }).code).toBe("PROOF_SECRET_MATERIAL");
  });

  it("does not accept proof when the current build identity is unavailable", () => {
    expect(validateInboundControlledProof({
      channel: "EMAIL_INBOUND",
      manifest: manifest() as never,
      expectedBuildSha: "",
      now,
    }).code).toBe("PROOF_BUILD_UNAVAILABLE");
  });

  it("parses only JSON object manifests", () => {
    expect(parseInboundControlledProof(JSON.stringify(manifest()))).toMatchObject({ channel: "EMAIL_INBOUND" });
    expect(parseInboundControlledProof("[]")).toBeUndefined();
    expect(parseInboundControlledProof("not-json")).toBeUndefined();
  });
});
