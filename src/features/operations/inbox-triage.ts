/**
 * Presentation-only Inbox triage. Works on a tenant-authorized staff snapshot;
 * never decides message delivery, verified identity, or handover authority.
 * The last external message determines whether a reply might be needed.
 */
export const inboxQueues = ["all", "needs-reply", "handover", "unverified"] as const;
export type InboxQueue = typeof inboxQueues[number];

export interface InboxTriageConversation {
  id: string;
  customerId?: string | null;
  handoverActive: boolean;
  lastMessageAt?: string | null;
}

export interface InboxTriageMessage {
  conversationId: string;
  direction: "INBOUND" | "OUTBOUND" | "INTERNAL";
  createdAt: string;
}

export interface InboxTriageCustomer {
  id: string;
}

export type InboxQueueCounts = Record<InboxQueue, number>;

export function normalizeInboxQueue(value?: string | null): InboxQueue {
  return inboxQueues.find((queue) => queue === value) ?? "all";
}

export function inboxQueueHref(
  queue: InboxQueue,
  conversationId?: string,
  search?: string,
): string {
  const params = new URLSearchParams();
  if (queue !== "all") params.set("queue", queue);
  if (conversationId) params.set("conversation", conversationId);
  if (search?.trim()) params.set("search", search.trim().slice(0, 120));
  const queryString = params.toString();
  return queryString ? "?" + queryString : "?";
}

export function buildInboxTriage<
  Conversation extends InboxTriageConversation,
  Message extends InboxTriageMessage,
  Customer extends InboxTriageCustomer,
>(
  conversations: readonly Conversation[],
  messages: readonly Message[],
  customers: readonly Customer[],
  queue: InboxQueue,
) {
  const knownCustomers = new Set(customers.map((customer) => customer.id));
  const recentExternal = new Map<string, Message>();

  for (const message of messages) {
    if (message.direction === "INTERNAL") continue;
    const previous = recentExternal.get(message.conversationId);
    const when = Date.parse(message.createdAt);
    const earlier = previous ? Date.parse(previous.createdAt) : Number.NEGATIVE_INFINITY;
    // Identical timestamps can occur for multiple provider deliveries.
    // Prefer an inbound message on ties so a pending customer response is
    // not silently hidden by nondeterministic database row ordering.
    if (Number.isFinite(when) &&
      (when > (Number.isFinite(earlier) ? earlier : Number.NEGATIVE_INFINITY) ||
      (when === earlier && message.direction === "INBOUND" && previous?.direction !== "INBOUND"))) {
      recentExternal.set(message.conversationId, message);
    }
  }

  const sorted = [...conversations].sort((a, b) => {
    const aTime = a.lastMessageAt ? Date.parse(a.lastMessageAt) : 0;
    const bTime = b.lastMessageAt ? Date.parse(b.lastMessageAt) : 0;
    return (Number.isFinite(bTime) ? bTime : 0) - (Number.isFinite(aTime) ? aTime : 0) ||
      a.id.localeCompare(b.id);
  });

  const counts: InboxQueueCounts = {
    all: sorted.length,
    "needs-reply": 0,
    handover: 0,
    unverified: 0,
  };

  const threadFlags = new Map<string, {
    needsReply: boolean;
    handover: boolean;
    unverified: boolean;
  }>();

  for (const conversation of sorted) {
    const last = recentExternal.get(conversation.id);
    const flags = {
      needsReply: last?.direction === "INBOUND",
      handover: conversation.handoverActive,
      unverified: !conversation.customerId || !knownCustomers.has(conversation.customerId),
    };
    threadFlags.set(conversation.id, flags);
    if (flags.needsReply) counts["needs-reply"]++;
    if (flags.handover) counts.handover++;
    if (flags.unverified) counts.unverified++;
  }

  const visible = queue === "all" ? sorted : sorted.filter((thread) => {
    const flags = threadFlags.get(thread.id);
    switch (queue) {
      case "needs-reply": return flags?.needsReply;
      case "handover": return flags?.handover;
      case "unverified": return flags?.unverified;
      default: return true;
    }
  });

  return { visible, counts, threadFlags };
}

/**
 * Filter an already tenant-authorized triage queue using visible conversation
 * metadata and the latest external message. Presentation only: this is not a
 * server-side search permission, identity verification or provider lookup.
 */
export function searchInboxQueue<
  Conversation extends InboxTriageConversation & { channel?: string },
  Message extends InboxTriageMessage & { body?: string | null },
  Customer extends InboxTriageCustomer & { displayName?: string | null },
>(
  conversations: readonly Conversation[],
  messages: readonly Message[],
  customers: readonly Customer[],
  rawSearch?: string | null,
): Conversation[] {
  const query = rawSearch?.trim().slice(0, 120).toLocaleLowerCase();
  if (!query) return [...conversations];

  const names = new Map(customers.map((customer) =>
    [customer.id, customer.displayName?.toLocaleLowerCase() ?? ""] as const));
  const latest = new Map<string, Message>();
  for (const message of messages) {
    if (message.direction === "INTERNAL") continue;
    const previous = latest.get(message.conversationId);
    const when = Date.parse(message.createdAt);
    if (!previous || (Number.isFinite(when) && when >= Date.parse(previous.createdAt))) {
      latest.set(message.conversationId, message);
    }
  }
  return conversations.filter((conversation) => {
    const searchable = [
      names.get(conversation.customerId ?? "") ?? "",
      conversation.channel ?? "",
      latest.get(conversation.id)?.body ?? "",
    ].join(" ").toLocaleLowerCase();
    return searchable.includes(query);
  });
}
