import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const runtime = readFileSync(
  join(process.cwd(), "src/features/operations/operational-product-runtime.ts"),
  "utf8",
);
const route = readFileSync(
  join(process.cwd(), "src/features/operations/OperationalProductRoute.tsx"),
  "utf8",
);

describe("V2 retention and attribution operational product", () => {
  it("loads growth tables independently so unavailable V2 data cannot break core operations", () => {
    expect(runtime).toContain('.from("retention_campaigns")');
    expect(runtime).toContain('.from("customer_retention_controls")');
    expect(runtime).toContain('.from("communication_consents")');
    expect(runtime).toContain("const retentionAvailable = !campaignRead.error && !retentionControlRead.error && !consentRead.error");
    expect(runtime).not.toMatch(/tableReads\.push\([^)]*retention_campaigns/);
  });

  it("collapses consent history to the latest channel truth per customer", () => {
    expect(runtime).toContain("latestConsentByCustomerChannel");
    expect(runtime).toContain("if (latestConsentByCustomerChannel.has(key)) continue");
    expect(runtime).toContain('channel === "EMAIL"');
    expect(runtime).toContain('channel !== "WHATSAPP"');
  });

  it("keeps internal retention holds separate from customer opt-in", () => {
    expect(route).toContain("Campaign opt-in");
    expect(route).toContain("No campaign opt-in");
    expect(route).toContain("Retention paused");
    expect(route).toContain("Retention suppressed");
    expect(route).toContain("Clearing an internal retention hold never grants campaign consent");
    expect(runtime).toContain("A current customer opt-in is still required before any campaign can send.");
  });

  it("shows directional referral-to-paid-job reporting without causal claims", () => {
    expect(route).toContain("Referral → paid job");
    expect(route).toContain("Touches");
    expect(route).toContain("Paid jobs");
    expect(route).toContain("Attribution is directional, not perfect");
    expect(route).not.toContain("Referral caused");
  });

  it("provides policy management but no send action from Settings", () => {
    expect(route).toContain("Save referral code");
    expect(route).toContain("Save campaign policy");
    expect(route).toContain("Saved policy is not a send.");
    expect(route).toContain("No customer message is queued from this screen.");
    expect(route).not.toContain("Send campaign now");
    expect(route).not.toContain("Queue campaign now");
  });

  it("avoids timezone-ambiguous referral validity controls", () => {
    expect(route).not.toContain('name="startsAt" type="datetime-local"');
    expect(route).not.toContain('name="endsAt" type="datetime-local"');
  });
});
