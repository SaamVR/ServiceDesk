import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("conversation inbox migration", () => {
  it("contains durable receipt identity and no anonymous mutation policy", () => {
    const sql = readFileSync("supabase/migrations/0008_conversation_inbox_runtime.sql", "utf8");
    expect(sql).toContain("provider_inbound_receipts");
    expect(sql).toContain("provider_receipt_key");
    expect(sql).toContain("raw_provider_event_ref");
    expect(sql).toContain("conversations_provider_thread_uq");
    expect(sql).not.toMatch(/for insert to anon/i);
  });
});
