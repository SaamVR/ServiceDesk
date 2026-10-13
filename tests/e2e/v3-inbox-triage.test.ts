import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildInboxTriage,
  inboxQueueHref,
  normalizeInboxQueue,
  type InboxTriageConversation,
  type InboxTriageMessage,
} from "../../src/features/operations/inbox-triage";

const thread = (
  id: string,
  customerId?: string,
  handoverActive = false,
  lastMessageAt = "2026-10-10T12:00:00Z",
): InboxTriageConversation => ({ id, customerId, handoverActive, lastMessageAt });
const message = (
  conversationId: string,
  direction: InboxTriageMessage["direction"],
  createdAt: string,
): InboxTriageMessage => ({ conversationId, direction, createdAt });

describe("V3 operational Inbox triage", () => {
  const conversations = [
    thread("c-inbound", "customer-1", false, "2026-10-10T11:00:00Z"),
    thread("c-answered", "customer-1", false, "2026-10-10T13:00:00Z"),
    thread("c-unverified", undefined, true, "2026-10-10T12:00:00Z"),
    thread("c-stale", "customer-unknown", false, "2026-10-10T10:00:00Z"),
  ];
  const messages = [
    message("c-inbound", "INBOUND", "2026-10-10T10:00:00Z"),
    message("c-inbound", "INTERNAL", "2026-10-10T10:55:00Z"),
    message("c-answered", "INBOUND", "2026-10-10T11:00:00Z"),
    message("c-answered", "OUTBOUND", "2026-10-10T13:00:00Z"),
    message("c-unverified", "INBOUND", "2026-10-10T12:00:00Z"),
    message("c-stale", "OUTBOUND", "2026-10-10T09:00:00Z"),
  ];
  const customers = [{ id: "customer-1" }];

  it("derives queue totals from authorized snapshots, not guessed unread counters", () => {
    const { counts, visible, threadFlags } = buildInboxTriage(conversations, messages, customers, "all");
    expect(counts).toEqual({
      all: 4,
      "needs-reply": 2,
      handover: 1,
      unverified: 2,
    });
    expect(visible.map((c) => c.id)).toEqual(["c-answered", "c-unverified", "c-inbound", "c-stale"]);
    expect(threadFlags.get("c-inbound")?.needsReply).toBe(true);
    expect(threadFlags.get("c-answered")?.needsReply).toBe(false);
    expect(threadFlags.get("c-unverified")?.unverified).toBe(true);
  });

  it("preserves distinct handover, unverified and last-inbound queues", () => {
    expect(buildInboxTriage(conversations, messages, customers, "needs-reply").visible.map(c => c.id))
      .toEqual(["c-unverified", "c-inbound"]);
    expect(buildInboxTriage(conversations, messages, customers, "handover").visible.map(c => c.id))
      .toEqual(["c-unverified"]);
    expect(buildInboxTriage(conversations, messages, customers, "unverified").visible.map(c => c.id))
      .toEqual(["c-unverified", "c-stale"]);
  });

  it("does not mark internal notes as outbound customer replies", () => {
    const result = buildInboxTriage(
      [thread("c", "customer-1")],
      [message("c", "INBOUND", "2026-10-10T10:00:00Z"), message("c", "INTERNAL", "2026-10-10T11:00:00Z")],
      customers,
      "needs-reply",
    );
    expect(result.visible).toHaveLength(1);
  });

  it("treats empty histories as unknown, not evidence of a pending reply", () => {
    const result = buildInboxTriage(
      [thread("empty", "customer-1")],
      [],
      customers,
      "needs-reply",
    );
    expect(result.counts["needs-reply"]).toBe(0);
    expect(result.visible).toHaveLength(0);
  });

  it("whitelists queue URLs and encodes selected conversation references", () => {
    expect(normalizeInboxQueue("handover")).toBe("handover");
    expect(normalizeInboxQueue("unverified")).toBe("unverified");
    expect(normalizeInboxQueue("needs-reply")).toBe("needs-reply");
    expect(normalizeInboxQueue("../evil")).toBe("all");
    expect(normalizeInboxQueue("all")).toBe("all");
    expect(inboxQueueHref("all")).toBe("?");
    expect(inboxQueueHref("handover", "a/b&c")).toBe("?queue=handover&conversation=a%2Fb%26c");
  });

  it("integrates query state, honest queue labels and preserved server commands", () => {
    const page = readFileSync(join(process.cwd(), "src/app/app/[workspace]/inbox/page.tsx"), "utf8");
    const main = readFileSync(join(process.cwd(), "src/features/operations/OperationalProductRoute.tsx"), "utf8");
    const css = readFileSync(join(process.cwd(), "src/features/operations/OperationalProductRoute.module.css"), "utf8");
    expect(page).toContain('selectedQueue={query.queue}');
    expect(main).toContain("buildInboxTriage(data.conversations, data.messages, data.customers, queue)");
    expect(main).toContain('<InboxQueueNavigation queue={queue} counts={triage.counts} />');
    expect(main).toContain('aria-label="Conversation queues"');
    expect(main).toContain('href={inboxQueueHref(queue, conversation.id)}');
    expect(main).toContain('href={inboxQueueHref("all", conversation.id)}');
    expect(main).toContain("toggleInboxHandover(workspaceSlug");
    expect(main).toContain("enqueueInboxReply(workspaceSlug");
    expect(main).toContain("resolveOperationalConversationIdentity(");
    expect(css).toContain(".inboxQueueNav");
    expect(css).toContain("@media (max-width: 800px)");
  });
});
