import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildInboxTriage } from "@/features/operations/inbox-triage";

describe("Today routes real unanswered conversations to the staff Inbox", () => {
  const conversations = [
    { id: "c1", customerId: "customer1", handoverActive: true, lastMessageAt: "2026-10-11T10:00:00Z" },
    { id: "c2", customerId: "customer1", handoverActive: false, lastMessageAt: "2026-10-11T10:00:00Z" },
  ];
  const messages = [
    { conversationId: "c1", direction: "INBOUND" as const, createdAt: "2026-10-11T10:00:00Z" },
    { conversationId: "c2", direction: "OUTBOUND" as const, createdAt: "2026-10-11T10:00:00Z" },
  ];
  const customers = [{ id: "customer1" }];
  it("counts only the latest inbound messages, not every existing thread", () => {
    expect(buildInboxTriage(conversations, messages, customers, "needs-reply").counts["needs-reply"]).toBe(1);
  });
  it("routes from the Today KPI to authenticated Needs reply, preserving downstream pipeline details", () => {
    const code = readFileSync(join(process.cwd(), "src/features/operations/StaffOverviewDashboard.tsx"), "utf8");
    expect(code).toContain('label="Inbox needs reply"');
    expect(code).toContain('buildStaffModuleHref(workspace, "inbox") + "?queue=needs-reply"');
    expect(code).toContain('buildInboxTriage(snapshot.conversations, snapshot.messages, snapshot.customers, "needs-reply")');
    expect(code).toContain('label="Outstanding"');
    expect(code).toContain('Requests to review');
    expect(code).toContain('Quotes with customer');
  });
});
