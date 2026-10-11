import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
const source = readFileSync(join(process.cwd(),"src/features/operations/StaffOverviewDashboard.tsx"),"utf8");
describe("Studio OS actionable reply work",()=>{
 it("uses authorized message data and the external-message triage model, never invented unread counts",()=>{
  expect(source).toContain('buildInboxTriage(snapshot.conversations, snapshot.messages, snapshot.customers, "all")');
  expect(source).toContain('replyTriage?.counts["needs-reply"]');
  expect(source).toContain("snapshot.conversations && snapshot.messages");
  expect(source).toContain("?queue=needs-reply");
 });
 it("makes operational priority selection explicit",()=>{
  expect(source).toContain('attention.length ? "automations" : unassignedToday ? "schedule" : waitingReplies ? "inbox"');
  expect(source).toContain("briefingAction");
  expect(source).toContain("Reply to customers");
  expect(source).toContain("?queue=unassigned");
 });
});
