import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const runtime = readFileSync(
  join(process.cwd(), "src/features/operations/operational-product-runtime.ts"),
  "utf8",
);

describe("V2 retention and referral action boundaries", () => {
  it("routes referral codes through the owner-only RPC", () => {
    expect(runtime).toContain('"servicedesk_upsert_referral_code"');
    expect(runtime).toContain('resolved.value.actor.role !== "OWNER"');
    expect(runtime).toContain("Attribution remains directional rather than proof of causality.");
  });

  it("routes campaign policy through an owner-only RPC and does not queue", () => {
    const start = runtime.indexOf("export async function upsertOperationalRetentionCampaign");
    const end = runtime.indexOf("export async function setOperationalCustomerRetentionControl", start);
    const action = runtime.slice(start, end);
    expect(action).toContain('"servicedesk_upsert_retention_campaign"');
    expect(action).toContain('resolved.value.actor.role !== "OWNER"');
    expect(action).not.toContain("servicedesk_queue_retention_campaign_message");
    expect(action).toContain("Every queued message will still recheck consent, suppression, quiet hours and caps at dispatch time.");
  });

  it("allows staff suppression changes without granting consent", () => {
    const start = runtime.indexOf("export async function setOperationalCustomerRetentionControl");
    const action = runtime.slice(start);
    expect(action).toContain('"servicedesk_set_customer_retention_control"');
    expect(action).toContain("Internal retention suppression cleared. A current customer opt-in is still required");
    expect(action).not.toContain("servicedesk_record_customer_consent");
  });
});
