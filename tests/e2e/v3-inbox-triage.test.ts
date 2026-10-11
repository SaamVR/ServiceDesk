import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import {
  buildInboxTriage,
  inboxQueueHref,
  normalizeInboxQueue,
  searchInboxQueue,
  indexLatestInboxMessages,
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

  it("conservatively flags inbound messages at identical external timestamps regardless of row order", () => {
    const tied = [
      message("tied", "OUTBOUND", "2026-10-10T10:00:00Z"),
      message("tied", "INBOUND", "2026-10-10T10:00:00Z"),
    ];
    for (const input of [tied, [...tied].reverse()]) {
      const result = buildInboxTriage([thread("tied", "customer-1")], input, customers, "needs-reply");
      expect(result.visible.map(item => item.id)).toEqual(["tied"]);
      expect(result.counts["needs-reply"]).toBe(1);
    }
  });

  it("stabilizes displayed order for equal conversation timestamps", () => {
    const rows = [thread("b", "customer-1"), thread("a", "customer-1")];
    for (const input of [rows, [...rows].reverse()]) {
      const result = buildInboxTriage(input, [], customers, "all");
      expect(result.visible.map(item => item.id)).toEqual(["a", "b"]);
    }
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

  it("searches only customer, channel and latest external message over triage-approved threads", () => {
    const rows = [
      { id: "thread-a", customerId: "customer-a", handoverActive: false, channel: "EMAIL" },
      { id: "thread-b", customerId: undefined, handoverActive: false, channel: "WHATSAPP" },
    ];
    const customerRows = [{ id: "customer-a", displayName: "Avery Patel" }];
    const messageRows = [
      { conversationId: "thread-a", direction: "INBOUND" as const, createdAt: "2026-10-11T01:00:00Z", body: "Old message" },
      { conversationId: "thread-a", direction: "OUTBOUND" as const, createdAt: "2026-10-11T02:00:00Z", body: "Booking confirmed" },
      { conversationId: "thread-a", direction: "INTERNAL" as const, createdAt: "2026-10-11T03:00:00Z", body: "Secret internal note" },
    ];
    expect(searchInboxQueue(rows, messageRows, customerRows, "avery").map((item) => item.id)).toEqual(["thread-a"]);
    expect(searchInboxQueue(rows, messageRows, customerRows, "WHATSAPP").map((item) => item.id)).toEqual(["thread-b"]);
    expect(searchInboxQueue(rows, messageRows, customerRows, "confirmed").map((item) => item.id)).toEqual(["thread-a"]);
    expect(searchInboxQueue(rows, messageRows, customerRows, "Old message")).toEqual([]);
    expect(searchInboxQueue(rows, messageRows, customerRows, "Secret internal note")).toEqual([]);
    expect(rows).toHaveLength(2);
  });

  it("indexes the latest stored preview in one pass with stable timestamp ties", () => {
    const a = { conversationId: "a", direction: "INBOUND" as const, createdAt: "2026-10-11T08:00:00Z", body: "A first" };
    const b = { conversationId: "b", direction: "INBOUND" as const, createdAt: "2026-10-11T09:00:00Z", body: "B current" };
    const newerA = { conversationId: "a", direction: "OUTBOUND" as const, createdAt: "2026-10-11T10:00:00Z", body: "A latest" };
    const tiedA = { conversationId: "a", direction: "INTERNAL" as const, createdAt: "2026-10-11T10:00:00Z", body: "A tied" };
    const result = indexLatestInboxMessages([a, b, newerA, tiedA]);
    expect(result.get("a")).toBe(newerA);
    expect(result.get("b")).toBe(b);
    expect(result.size).toBe(2);
  });

  it("carries search state safely through queue links", () => {
    expect(inboxQueueHref("handover", "a/b&c", "Briar & Co")).toBe("?queue=handover&conversation=a%2Fb%26c&search=Briar+%26+Co");
    expect(inboxQueueHref("all", undefined, "  Cleaning ")).toBe("?search=Cleaning");
  });

  it("fails closed without explicit isolated QA authorization", () => {
    const run = spawnSync(process.execPath, ["tests/e2e/v3-capture-workroom.mjs"], {
      encoding: "utf8",
      timeout: 10000,
      env: { ...process.env, V3_QA_ISOLATED: "0" },
    });
    expect(run.error).toBeUndefined();
    expect(run.status).not.toBe(0);
    expect(run.stderr).toContain("Isolated QA permission required");
  });

  it("does not mistake viewport capture for actual deployment SHA verification", () => {
    const source = readFileSync(join(process.cwd(), "tests/e2e/v3-capture-workroom.mjs"), "utf8");
    expect(source).toContain("Emulation.setDeviceMetricsOverride");
    expect(source).toContain("Page.captureScreenshot");
    expect(source).toContain("validatePNG");
    expect(source).toContain("Horizontal overflow at");
    expect(source).toContain("independentlyVerifiedSourceSha: false");
  });

  it("keeps the standalone Chromium visual acceptance runner syntactically valid", () => {
    const run = spawnSync(process.execPath, ["--check", "tests/e2e/v3-capture-workroom.mjs"], {
      encoding: "utf8",
      timeout: 10000,
    });
    expect(run.error).toBeUndefined();
    expect(run.status, run.stderr).toBe(0);
  });

  it("integrates query state, honest queue labels and preserved server commands", () => {
    const page = readFileSync(join(process.cwd(), "src/app/app/[workspace]/inbox/page.tsx"), "utf8");
    const main = readFileSync(join(process.cwd(), "src/features/operations/OperationalProductRoute.tsx"), "utf8");
    const css = readFileSync(join(process.cwd(), "src/features/operations/OperationalProductRoute.module.css"), "utf8");
    expect(page).toContain('selectedQueue={query.queue}');
    expect(main).toContain("buildInboxTriage(data.conversations, data.messages, data.customers, queue)");
    expect(main).toContain('<InboxQueueNavigation queue={queue} counts={triage.counts} search={search} />');
    expect(main).toContain('searchInboxQueue(triage.visible, data.messages, data.customers, search)');
    expect(main).toContain("indexLatestInboxMessages(data.messages)");
    expect(main).toContain('<InboxSearchForm queue={queue} search={search} />');
    expect(page).toContain('searchQuery={query.search}');
    expect(main).toContain('aria-label="Conversation queues"');
    expect(main).toContain('href={inboxQueueHref(queue, conversation.id, search) + "#active-inbox-thread"}');
    expect(main).toContain('href={inboxQueueHref("all", conversation.id, search)}');
    expect(main).toContain("toggleInboxHandover(workspaceSlug");
    expect(main).toContain("enqueueInboxReply(workspaceSlug");
    expect(main).toContain("resolveOperationalConversationIdentity(");
    expect(main).toContain('aria-live="polite"');
    expect(main).toContain('href="#inbox-conversation-list"');
    expect(main).toContain('id="active-inbox-thread"');
    expect(main).toContain("activeQuote.status");
    expect(main).toContain("relatedVisit.status");
    expect(main).toContain("relatedInvoice.status");
    expect(main).toContain('href={inboxQueueHref(queue)}>Clear search</a>');
    expect(css).toContain(".inboxResultsBar");
    expect(css).toContain(".inboxMobileJump");
    expect(css).toContain(".inboxQueueNav");
    expect(css).toContain("@media (max-width: 800px)");
  });
});
