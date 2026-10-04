import { describe, expect, test } from "vitest";
import { auditConnectorRedaction, summarizeRedactionAudit } from "../../src/server/integrations/closure/redaction-audit";

describe("connector redaction audit", () => {
  test("flags secrets, bearer tokens, raw customer contacts, and provider URLs", () => {
    const audit = auditConnectorRedaction({
      provider: "PAYMENT",
      artifactName: "bad receipt",
      value: {
        authorization: "Bearer sk_test_secret",
        email: "customer@example.com",
        downloadUrl: "https://graph.facebook.com/media/private",
      },
    });

    expect(audit.safeForOperatorLog).toBe(false);
    expect(audit.findings.map((finding) => finding.kind)).toEqual(expect.arrayContaining(["SECRET", "BEARER_TOKEN", "EMAIL", "PROVIDER_URL"]));
    expect(JSON.stringify(audit)).not.toContain("sk_test_secret");
    expect(JSON.stringify(audit)).not.toContain("customer@example.com");
  });

  test("summarizes safe evidence without provider verification inflation", () => {
    const safe = auditConnectorRedaction({
      provider: "WEBHOOK",
      artifactName: "redacted receipt",
      value: {
        provider: "WEBHOOK",
        verification: "CONTRACT_TESTED",
        redactedReceipt: "exec_123…abcd",
        notes: ["delivery accepted by fixture receiver"],
      },
    });

    const summary = summarizeRedactionAudit([safe]);
    expect(summary).toEqual({ total: 1, unsafe: 0, safe: 1, providerVerifiedClaims: 0 });
  });
});
