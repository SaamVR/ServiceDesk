import { describe, expect, it } from "vitest";
import { inboxQueueHref, searchInboxQueue } from "@/features/operations/inbox-triage";

const conversations = [
  { id: "thread-2", customerId: "c2", channel: "EMAIL", handoverActive: false, lastMessageAt: "2026-10-10T12:00:00Z" },
  { id: "thread-1", customerId: "c1", channel: "WHATSAPP", handoverActive: true, lastMessageAt: "2026-10-11T08:00:00Z" },
  { id: "thread-3", customerId: null, channel: "VOICE", handoverActive: false, lastMessageAt: null },
] as const;
const customers = [
  { id: "c1", displayName: "Amira Hassan" },
  { id: "c2", displayName: "Briar Studio" },
] as const;
const messages = [
  { conversationId: "thread-1", direction: "INBOUND" as const, createdAt: "2026-10-11T07:00:00Z", body: "Please confirm the afternoon visit." },
  { conversationId: "thread-1", direction: "INTERNAL" as const, createdAt: "2026-10-11T07:50:00Z", body: "CONFIDENTIAL_ESCALATION" },
  { conversationId: "thread-1", direction: "OUTBOUND" as const, createdAt: "2026-10-11T08:00:00Z", body: "Confirmed for Tuesday." },
  { conversationId: "thread-2", direction: "INBOUND" as const, createdAt: "2026-10-10T12:00:00Z", body: "We need window cleaning." },
];

describe("real inbox search over authorized snapshot data", () => {
  it("filters by customer display name, case-insensitively", () => {
    expect(searchInboxQueue(conversations, messages, customers, "  aMiRa " ).map((item) => item.id)).toEqual(["thread-1"]);
  });
  it("matches the channel when no verified customer exists", () => {
    expect(searchInboxQueue(conversations, messages, customers, "voice").map((item) => item.id)).toEqual(["thread-3"]);
  });
  it("searches the latest external message and not an old or internal message", () => {
    expect(searchInboxQueue(conversations, messages, customers, "Tuesday").map((item) => item.id)).toEqual(["thread-1"]);
    expect(searchInboxQueue(conversations, messages, customers, "CONFIDENTIAL_ESCALATION")).toEqual([]);
    expect(searchInboxQueue(conversations, messages, customers, "afternoon")).toEqual([]);
  });
  it("preserves the existing triage order without editing authoritative records", () => {
    const input = [...conversations];
    expect(searchInboxQueue(input, messages, customers, " ")).toEqual(conversations);
    expect(input).toEqual(conversations);
  });
  it("keeps queue and thread when navigating search matches", () => {
    expect(inboxQueueHref("needs-reply", "thread-1", "Briar & Amira")).toBe("?queue=needs-reply&conversation=thread-1&search=Briar+%26+Amira");
    expect(inboxQueueHref("all", undefined, "  Window ")).toBe("?search=Window");
    expect(inboxQueueHref("all")).toBe("?");
  });
});
